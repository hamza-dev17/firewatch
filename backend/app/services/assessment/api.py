"""Assessment API orchestration for selected-location on-demand assessments."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from enum import Enum

import httpx
from app.core.config import get_settings
from app.services.assessment.decision import DecisionSupportService, RiskTrend
from app.services.prediction.service import PredictionServiceError
from app.services.weather.openweather import build_weather_window_payload, WeatherServiceError


class AssessmentServiceError(RuntimeError):
    """Raised when the assessment orchestration cannot produce a live result."""


class ModelUnavailableError(AssessmentServiceError):
    """Raised when the selected model artifact cannot be loaded."""


class NarrativeSourceState(str, Enum):
    LIVE = "live"
    FALLBACK = "fallback"


_GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"
_GROQ_MODEL = "llama-3.1-8b-instant"


def build_decision_support_service() -> DecisionSupportService:
    settings = get_settings()
    try:
        return DecisionSupportService.from_artifact_path(settings.model_artifact_path)
    except PredictionServiceError as exc:
        raise ModelUnavailableError("Model unavailable; assessment cannot be generated.") from exc


def _as_datetime(timestamp: str) -> datetime:
    return datetime.fromisoformat(timestamp.replace("Z", "+00:00")).astimezone(UTC)


def _freshness_minutes_from_timestamp(timestamp: str, now: datetime) -> int:
    delta = now - _as_datetime(timestamp)
    seconds = max(0.0, delta.total_seconds())
    return int(seconds // 60)


def _risk_trend_from_scores(previous_score: float | None, current_score: float) -> RiskTrend:
    if previous_score is None:
        return RiskTrend.STABLE
    if current_score > previous_score:
        return RiskTrend.RISING
    if current_score < previous_score:
        return RiskTrend.DECREASING
    return RiskTrend.STABLE


def _fallback_briefing(payload: dict[str, object]) -> str:
    risk_level = str(payload.get("risk_level", "unknown")).upper()
    location_name = str(payload.get("location_name", "the selected location"))
    forecast_window = str(payload.get("forecast_window", "now"))
    recommended_action = str(payload.get("recommended_action", "continue routine monitoring"))
    return (
        f"{risk_level} relative wildfire risk for {location_name} ({forecast_window}). "
        f"Recommended action: {recommended_action}."
    )


def _request_groq_narrative(payload: dict[str, object], groq_api_key: str) -> str:
    system_prompt = (
        "You generate calm operational briefing text for wildfire risk monitoring. "
        "Use only the JSON facts provided by the user and keep it concise."
    )
    user_payload = json.dumps(payload, ensure_ascii=True)

    with httpx.Client(timeout=12.0) as client:
        response = client.post(
            _GROQ_CHAT_COMPLETIONS_URL,
            headers={
                "Authorization": f"Bearer {groq_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": _GROQ_MODEL,
                "temperature": 0.2,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_payload},
                ],
            },
        )

    if response.status_code >= 400:
        raise RuntimeError("Groq request failed.")

    payload_json = response.json()
    if not isinstance(payload_json, dict):
        raise RuntimeError("Groq response has unsupported format.")

    choices = payload_json.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("Groq response has no choices.")

    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        raise RuntimeError("Groq response choice has unsupported format.")

    message = first_choice.get("message")
    if not isinstance(message, dict):
        raise RuntimeError("Groq response message has unsupported format.")

    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("Groq response content is empty.")

    return content.strip()


def build_narrative_briefing(payload: dict[str, object]) -> dict[str, object]:
    settings = get_settings()
    groq_api_key = settings.groq_api_key

    if not groq_api_key:
        return {
            "narrative_explanation": _fallback_briefing(payload),
            "narrative_source_label": "fallback",
            "narrative_source_state": NarrativeSourceState.FALLBACK.value,
        }

    try:
        narrative_text = _request_groq_narrative(payload=payload, groq_api_key=groq_api_key)
    except Exception:
        return {
            "narrative_explanation": _fallback_briefing(payload),
            "narrative_source_label": "fallback",
            "narrative_source_state": NarrativeSourceState.FALLBACK.value,
        }

    return {
        "narrative_explanation": narrative_text,
        "narrative_source_label": "live",
        "narrative_source_state": NarrativeSourceState.LIVE.value,
    }


def build_assessment_response(
    *,
    location: dict[str, object],
    forecast_windows: list[str],
) -> dict[str, object]:
    latitude = float(location["latitude"])
    longitude = float(location["longitude"])

    weather_payload = build_weather_window_payload(
        latitude=latitude,
        longitude=longitude,
        forecast_windows=forecast_windows,
    )
    if weather_payload.get("source_state") != "live":
        raise AssessmentServiceError("Weather source is degraded; cannot create live assessment.")

    decision_support = build_decision_support_service()

    now = datetime.now(tz=UTC)
    narrative_labels: set[str] = set()
    forecast_assessments: list[dict[str, object]] = []
    previous_risk_score: float | None = None

    weather_windows = weather_payload.get("forecast_windows", [])
    if not isinstance(weather_windows, list):
        weather_windows = []

    for weather_window in weather_windows:
        if not isinstance(weather_window, dict):
            continue

        prediction_inputs = weather_window["prediction_inputs"]
        prediction_input_units = weather_window["prediction_input_units"]
        matched_weather_timestamp = str(weather_window["matched_weather_timestamp"])
        data_freshness_minutes = _freshness_minutes_from_timestamp(matched_weather_timestamp, now)

        baseline = decision_support.assess_feature_vector(
            feature_values=prediction_inputs,
            feature_units=prediction_input_units,
            risk_trend=RiskTrend.STABLE,
            data_freshness_minutes=data_freshness_minutes,
        )
        risk_trend = _risk_trend_from_scores(previous_risk_score, baseline.risk_score)
        decision = decision_support.assess_risk_score(
            risk_score=baseline.risk_score,
            model_confidence=baseline.model_confidence,
            risk_trend=risk_trend,
            data_freshness_minutes=data_freshness_minutes,
        )

        narrative_payload = {
            "location_name": location.get("name") or "Selected location",
            "forecast_window": weather_window["forecast_window"],
            "matched_weather_timestamp": matched_weather_timestamp,
            "risk_level": decision.risk_level,
            "risk_score": round(decision.risk_score, 4),
            "model_confidence": None if decision.model_confidence is None else round(decision.model_confidence, 4),
            "recommended_action": decision.recommended_action,
            "monitoring_radius": decision.monitoring_radius,
            "weather_signals": weather_window.get("weather_signals", {}),
            "data_source_label": weather_payload.get("data_source_label", "live"),
        }
        narrative = build_narrative_briefing(narrative_payload)
        narrative_labels.add(str(narrative.get("narrative_source_label", "fallback")))

        forecast_assessments.append(
            {
                "forecast_window": weather_window["forecast_window"],
                "matched_weather_timestamp": matched_weather_timestamp,
                "runtime_feature_source_state": weather_payload["source_state"],
                "risk_score": round(decision.risk_score, 4),
                "risk_level": decision.risk_level,
                "model_confidence": None if decision.model_confidence is None else round(decision.model_confidence, 4),
                "risk_trend": risk_trend.value,
                "priority_score": round(decision.priority_score, 4),
                "priority_rank": decision.priority_rank,
                "priority_factors": decision.priority_factors,
                "monitoring_radius": decision.monitoring_radius,
                "recommended_action": decision.recommended_action,
                "risk_alert_expiry_hours": decision.risk_alert_expiry_hours,
                "threshold_version": decision.threshold_version,
                "recommendation_rule_version": decision.recommendation_rule_version,
                "weather_signals": weather_window.get("weather_signals", {}),
                "narrative_explanation": narrative["narrative_explanation"],
                "narrative_source_label": narrative["narrative_source_label"],
            }
        )
        previous_risk_score = decision.risk_score

    narrative_label = "live" if narrative_labels == {"live"} else "fallback"
    return {
        "source_state": "live",
        "location": location,
        "forecast_assessments": forecast_assessments,
        "data_source_labels": {
            "assessment": "live",
            "weather": weather_payload.get("data_source_label", "live"),
            "narrative": narrative_label,
        },
        "message": None,
    }
