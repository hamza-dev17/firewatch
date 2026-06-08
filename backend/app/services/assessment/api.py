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
_PREDICTION_INPUT_LABELS = {
    "temperature_c": "temperature",
    "temperature_min_c": "minimum temperature",
    "temperature_max_c": "maximum temperature",
    "rain_mm": "rainfall",
    "wind_speed_mps": "wind speed",
    "wind_gust_mps": "wind gust",
}
_WEATHER_SIGNAL_LABELS = {
    "humidity_pct": "humidity",
    "cloud_cover_pct": "cloud cover",
    "precipitation_probability_pct": "precipitation probability",
}
_WEATHER_SIGNAL_UNITS = {
    "humidity_pct": "%",
    "cloud_cover_pct": "%",
    "precipitation_probability_pct": "%",
}


def build_decision_support_service(model_algorithm: str | None = None) -> DecisionSupportService:
    settings = get_settings()
    try:
        return DecisionSupportService.from_artifact_path(
            settings.model_artifact_path,
            algorithm=model_algorithm,
        )
    except PredictionServiceError as exc:
        raise ModelUnavailableError(str(exc)) from exc


def _format_payload_value(value: object, unit: object | None = None) -> str:
    if isinstance(value, float) and value.is_integer():
        value_text = str(int(value))
    else:
        value_text = str(value)

    if not unit:
        return value_text

    unit_text = str(unit)
    if unit_text == "%":
        return f"{value_text}%"
    return f"{value_text} {unit_text}"


def _join_phrases(phrases: list[str]) -> str:
    if not phrases:
        return ""
    if len(phrases) == 1:
        return phrases[0]
    if len(phrases) == 2:
        return f"{phrases[0]} and {phrases[1]}"
    return f"{', '.join(phrases[:-1])}, and {phrases[-1]}"


def _prediction_input_phrases(payload: dict[str, object]) -> list[str]:
    prediction_inputs = payload.get("prediction_inputs")
    if not isinstance(prediction_inputs, dict):
        return []

    prediction_input_units = payload.get("prediction_input_units")
    if not isinstance(prediction_input_units, dict):
        prediction_input_units = {}

    phrases: list[str] = []
    for key, label in _PREDICTION_INPUT_LABELS.items():
        value = prediction_inputs.get(key)
        if value is None:
            continue
        phrases.append(f"{label} {_format_payload_value(value, prediction_input_units.get(key))}")
    return phrases


def _weather_signal_context(payload: dict[str, object]) -> str | None:
    weather_signals = payload.get("weather_signals")
    if not isinstance(weather_signals, dict):
        return None

    signal_phrases: list[str] = []
    for key, label in _WEATHER_SIGNAL_LABELS.items():
        value = weather_signals.get(key)
        if value is None:
            continue
        signal_phrases.append(f"{label} {_format_payload_value(value, _WEATHER_SIGNAL_UNITS.get(key))}")

    weather_description = weather_signals.get("weather_description")
    if isinstance(weather_description, str) and weather_description.strip():
        signal_phrases.append(f"{weather_description.strip()} context")

    if not signal_phrases:
        return None
    return f"Weather Signals add {_join_phrases(signal_phrases[:2])}."


def _fallback_briefing(payload: dict[str, object]) -> str:
    risk_level = str(payload.get("risk_level", "unknown")).upper()
    location_name = str(payload.get("location_name", "the selected location"))
    forecast_window = str(payload.get("forecast_window", "now"))
    risk_trend = str(payload.get("risk_trend", "stable")).replace("_", " ")
    recommended_action = str(payload.get("recommended_action", "continue routine monitoring"))
    monitoring_radius = str(payload.get("monitoring_radius", "the configured monitoring radius"))
    priority_rank = payload.get("priority_rank")
    driver_text = _join_phrases(_prediction_input_phrases(payload))
    if not driver_text:
        driver_text = "available runtime weather inputs"

    lines = [
        (
            f"{risk_level} relative wildfire risk for {location_name} in the {forecast_window} Forecast Window. "
            f"Risk Trend is {risk_trend}."
        ),
        (
            f"Prediction Inputs include {driver_text}; these are model input drivers for risk-favoring conditions, "
            "describing model behavior, not confirmed wildfire causality or proven real-world wildfire causality."
        ),
    ]

    weather_signal_context = _weather_signal_context(payload)
    if weather_signal_context:
        lines.append(f"{weather_signal_context} These are display-only context unless listed as Prediction Inputs.")

    priority_text = f" Priority Rank: {priority_rank}." if priority_rank else ""
    lines.append(
        f"Approved recommended action: {recommended_action}. Monitor within the {monitoring_radius} advisory radius."
        f"{priority_text}"
    )

    return (
        " ".join(lines)
    )


def _request_groq_narrative(payload: dict[str, object], groq_api_key: str) -> str:
    system_prompt = (
        "You generate calm Operational Briefing Text for FIREWATCH DSS wildfire risk monitoring. "
        "Use only the JSON Assessment Payload provided by the user. Write 2-4 concise sentences that explain "
        "why the Risk Level is elevated, reduced, stable, or increasing by referring to approved Prediction Inputs, "
        "Forecast Window context, Risk Trend, and relevant Weather Signals. Distinguish Prediction Inputs from "
        "display-only Weather Signals when both are mentioned. Do not restate the weather grid as a list. "
        "Do not create or change Recommended Action, Monitoring Radius, Risk Level, Risk Score, or Priority Rank. "
        "Do not claim confirmed fire, official emergency status, dispatch authority, or proven real-world causality. "
        "Describe model behavior and risk-favoring conditions only."
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
    model_algorithm: str | None = None,
) -> dict[str, object]:
    def _build_decision_support() -> DecisionSupportService:
        if model_algorithm:
            return build_decision_support_service(model_algorithm)
        return build_decision_support_service()

    try:
        return build_on_demand_assessment(
            location=location,
            forecast_windows=forecast_windows,
            deps=AssessmentWorkflowDependencies(
                build_weather_window_payload=build_weather_window_payload,
                build_decision_support_service=_build_decision_support,
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
