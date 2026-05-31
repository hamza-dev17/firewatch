"""Assessment API orchestration for selected-location on-demand assessments."""

from __future__ import annotations

import json
from enum import Enum

import httpx
from app.core.config import get_settings
from app.services.alerts.repository import build_risk_alert_repository
from app.services.history.repository import build_prediction_history_repository
from app.services.assessment.decision import DecisionSupportService
from app.services.assessment.workflow import (
    AssessmentServiceError,
    AssessmentWorkflowDependencies,
    build_on_demand_assessment,
)
from app.services.prediction.service import PredictionServiceError
from app.services.weather.openweather import build_weather_window_payload, WeatherServiceError


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


def _save_history_record(**kwargs: object) -> str:
    return build_prediction_history_repository().save_record(**kwargs)


def _replace_risk_alerts(**kwargs: object) -> list[str]:
    return build_risk_alert_repository().replace_active_alerts(**kwargs)


def build_assessment_response(
    *,
    location: dict[str, object],
    forecast_windows: list[str],
) -> dict[str, object]:
    try:
        return build_on_demand_assessment(
            location=location,
            forecast_windows=forecast_windows,
            deps=AssessmentWorkflowDependencies(
                build_weather_window_payload=build_weather_window_payload,
                build_decision_support_service=build_decision_support_service,
                build_narrative_briefing=build_narrative_briefing,
                save_history_record=_save_history_record,
                replace_risk_alerts=_replace_risk_alerts,
            ),
        )
    except ModelUnavailableError as exc:
        return {
            "source_state": "degraded",
            "location": location,
            "forecast_assessments": [],
            "data_source_labels": {
                "assessment": "unavailable",
                "weather": "unavailable",
                "narrative": "unavailable",
            },
            "message": str(exc),
        }
