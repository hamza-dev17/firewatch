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


class AssistantSourceState(str, Enum):
    LIVE = "live"
    FALLBACK = "fallback"
    UNAVAILABLE = "unavailable"


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
_WINDOW_LABELS = {
    "now": "Now",
    "24h": "24h",
    "48h": "48h",
    "72h": "72h",
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


def _window_label(forecast_window: object) -> str:
    return _WINDOW_LABELS.get(str(forecast_window), str(forecast_window))


def _numeric_value(mapping: object, key: str) -> float | None:
    if not isinstance(mapping, dict):
        return None
    value = mapping.get(key)
    if isinstance(value, bool) or value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _delta_phrase(
    *,
    previous: dict[str, object],
    current: dict[str, object],
    source_key: str,
    value_key: str,
    label: str,
    unit: str,
    higher_word: str,
    lower_word: str,
) -> str | None:
    previous_value = _numeric_value(previous.get(source_key), value_key)
    current_value = _numeric_value(current.get(source_key), value_key)
    if previous_value is None or current_value is None or previous_value == current_value:
        return None

    delta = abs(current_value - previous_value)
    direction = higher_word if current_value > previous_value else lower_word
    return f"{label} is {direction} by {_format_payload_value(delta, unit)}"


def _find_selected_window(
    forecast_assessments: list[dict[str, object]],
    forecast_window: object,
) -> tuple[int, dict[str, object]] | None:
    for index, assessment in enumerate(forecast_assessments):
        if str(assessment.get("forecast_window")) == str(forecast_window):
            return index, assessment
    return None


def _unsupported_assistant_answer(message: str) -> dict[str, object]:
    return {
        "answer": message,
        "answer_source_label": "unavailable",
        "answer_source_state": AssistantSourceState.UNAVAILABLE.value,
        "supported_question": False,
    }


def _is_unsafe_operational_question(question: str) -> bool:
    unsafe_terms = (
        "evacuate",
        "evacuation",
        "dispatch",
        "send crews",
        "deploy crews",
        "emergency status",
        "official alert",
        "official emergency",
        "confirmed fire",
        "active fire",
        "fire detected",
        "issue an order",
        "order residents",
    )
    return any(term in question for term in unsafe_terms)


def _is_out_of_scope_assistant_question(question: str) -> bool:
    out_of_scope_terms = (
        "2021 wildfire",
        "2022 wildfire",
        "incident",
        "cause of",
        "caused the",
        "who started",
        "satellite hotspot",
        "thermal hotspot",
        "burned area",
        "damage estimate",
        "casualties",
        "news",
    )
    return any(term in question for term in out_of_scope_terms)


def _unsafe_operational_answer() -> dict[str, object]:
    return _unsupported_assistant_answer(
        "The assessment assistant cannot provide evacuation guidance and cannot issue dispatch instructions. "
        "Use the approved recommended action already shown in the selected Wildfire Risk Assessment, and follow authoritative procedures outside FIREWATCH DSS."
    )


def _out_of_scope_assistant_answer() -> dict[str, object]:
    return _unsupported_assistant_answer(
        "Answers are limited to the selected Wildfire Risk Assessment and Forecast Window. "
        "FIREWATCH DSS is not a fire incident source, official emergency source, or causality investigation source."
    )


def _build_window_comparison_answer(
    *,
    location_name: str | None,
    forecast_window: str,
    forecast_assessments: list[dict[str, object]],
) -> dict[str, object]:
    selected = _find_selected_window(forecast_assessments, forecast_window)
    if selected is None:
        return _unsupported_assistant_answer(
            "Forecast Window comparison is unavailable because the selected Forecast Window is missing from the approved assessment facts."
        )

    selected_index, current = selected
    if selected_index == 0:
        return _unsupported_assistant_answer(
            "Forecast Window comparison is unavailable because an earlier comparison window is missing from the approved assessment facts."
        )

    place = location_name or "the selected location"
    selected_window = _window_label(current.get("forecast_window"))
    risk_score_current = current.get("risk_score")

    lines = [f"Forecast Window comparison for {place} across available windows; selected window is {selected_window}."]
    if risk_score_current is not None:
        lines[0] += f" The selected window risk score is {_format_payload_value(risk_score_current)}."

    for previous, next_assessment in zip(forecast_assessments, forecast_assessments[1:]):
        previous_window = _window_label(previous.get("forecast_window"))
        next_window = _window_label(next_assessment.get("forecast_window"))
        trend_previous = str(previous.get("risk_trend", "stable")).replace("_", " ")
        trend_current = str(next_assessment.get("risk_trend", "stable")).replace("_", " ")
        level_previous = str(previous.get("risk_level", "unknown"))
        level_current = str(next_assessment.get("risk_level", "unknown"))

        input_deltas = [
            _delta_phrase(
                previous=previous,
                current=next_assessment,
                source_key="model_input_drivers",
                value_key="temperature_c",
                label="temperature",
                unit="C",
                higher_word="hotter",
                lower_word="cooler",
            ),
            _delta_phrase(
                previous=previous,
                current=next_assessment,
                source_key="model_input_drivers",
                value_key="wind_speed_mps",
                label="wind speed",
                unit="m/s",
                higher_word="stronger",
                lower_word="weaker",
            ),
            _delta_phrase(
                previous=previous,
                current=next_assessment,
                source_key="model_input_drivers",
                value_key="rain_mm",
                label="rainfall",
                unit="mm",
                higher_word="higher",
                lower_word="lower",
            ),
        ]
        input_deltas = [delta for delta in input_deltas if delta]

        signal_deltas = [
            _delta_phrase(
                previous=previous,
                current=next_assessment,
                source_key="weather_signals",
                value_key="humidity_pct",
                label="humidity",
                unit="%",
                higher_word="higher",
                lower_word="lower",
            ),
            _delta_phrase(
                previous=previous,
                current=next_assessment,
                source_key="weather_signals",
                value_key="precipitation_probability_pct",
                label="precipitation probability",
                unit="%",
                higher_word="higher",
                lower_word="lower",
            ),
        ]
        signal_deltas = [delta for delta in signal_deltas if delta]

        pair_lines = [
            (
                f"{previous_window} to {next_window}: Risk Trend changes from {trend_previous} to "
                f"{trend_current}, and Risk Level changes from {level_previous} to {level_current}."
            )
        ]
        if input_deltas:
            pair_lines.append(f"Prediction Inputs show {_join_phrases(input_deltas)}.")
        if signal_deltas:
            pair_lines.append(f"Weather Signals add context: {_join_phrases(signal_deltas)}.")
        lines.append(" ".join(pair_lines))

    if len(lines) == 1:
        return _unsupported_assistant_answer(
            "Forecast Window comparison is unavailable because another comparable Forecast Window is missing from the approved assessment facts."
        )

    lines.append(
        "This explains model behavior and risk-favoring conditions only; it does not claim confirmed incidents, "
        "official certainty, spread behavior, or proven real-world causality."
    )

    return {
        "answer": " ".join(lines),
        "answer_source_label": "bounded-fallback",
        "answer_source_state": AssistantSourceState.FALLBACK.value,
        "supported_question": True,
    }


def _build_single_window_assistant_answer(
    *,
    question: str,
    location_name: str | None,
    forecast_window: str,
    assessment: dict[str, object],
) -> dict[str, object]:
    place = location_name or "the selected location"
    window = _window_label(forecast_window)
    drivers = _join_phrases(_prediction_input_phrases({"prediction_inputs": assessment.get("model_input_drivers", {})}))
    if not drivers:
        return _unsupported_assistant_answer(
            "Assessment assistant is unavailable because Prediction Inputs are missing for this Forecast Window."
        )

    return {
        "answer": (
            f"The main Prediction Inputs available for {place} in the {window} Forecast Window are {drivers}. "
            "The answer is limited to the selected Wildfire Risk Assessment and describes model behavior, not proven real-world causality."
        ),
        "answer_source_label": "bounded-fallback",
        "answer_source_state": AssistantSourceState.FALLBACK.value,
        "supported_question": True,
    }


def _assistant_answer_has_disallowed_claim(answer: str) -> bool:
    normalized = answer.lower()
    disallowed_terms = (
        "confirmed fire",
        "active fire",
        "fire detected",
        "official emergency",
        "evacuate",
        "evacuation",
        "dispatch",
        "proven causality",
        "caused the wildfire",
    )
    return any(term in normalized for term in disallowed_terms)


def _request_groq_assistant_answer(
    *,
    question: str,
    payload: dict[str, object],
    groq_api_key: str,
) -> str:
    system_prompt = (
        "You are the bounded Assessment Assistant inside FIREWATCH DSS. Answer only questions about the selected "
        "Wildfire Risk Assessment and selected Forecast Window using the JSON payload provided. Keep the answer to "
        "2-4 concise sentences. You may explain Prediction Inputs, Weather Signals, Risk Trend, model behavior, "
        "data source labels, and limitations. You must not change, override, recalculate, or invent Risk Level, "
        "Risk Score, Recommended Action, Monitoring Radius, Priority Rank, or Risk Alert state. Do not provide "
        "evacuation guidance, dispatch instructions, official emergency status, confirmed fire claims, incident "
        "reports, or proven real-world causality. If a question asks for those, say the assistant is limited to "
        "the selected assessment facts."
    )
    user_payload = json.dumps(
        {
            "question": question,
            "selected_assessment_context": payload,
        },
        ensure_ascii=True,
    )

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
        raise RuntimeError("Groq assistant request failed.")

    payload_json = response.json()
    if not isinstance(payload_json, dict):
        raise RuntimeError("Groq assistant response has unsupported format.")

    choices = payload_json.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("Groq assistant response has no choices.")

    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        raise RuntimeError("Groq assistant response choice has unsupported format.")

    message = first_choice.get("message")
    if not isinstance(message, dict):
        raise RuntimeError("Groq assistant response message has unsupported format.")

    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("Groq assistant response content is empty.")

    answer = content.strip()
    if _assistant_answer_has_disallowed_claim(answer):
        raise RuntimeError("Groq assistant response crossed assessment guardrails.")
    return answer


def _with_live_assistant_answer(
    *,
    question: str,
    original_payload: dict[str, object],
    fallback_answer: dict[str, object],
) -> dict[str, object]:
    if fallback_answer.get("supported_question") is not True:
        return fallback_answer

    groq_api_key = get_settings().groq_api_key
    if not groq_api_key:
        return fallback_answer

    try:
        answer = _request_groq_assistant_answer(
            question=question,
            payload={
                "location_name": original_payload.get("location_name"),
                "forecast_window": original_payload.get("forecast_window"),
                "assessment": original_payload.get("assessment"),
                "forecast_assessments": original_payload.get("forecast_assessments"),
                "data_source_labels": original_payload.get("data_source_labels", {}),
            },
            groq_api_key=groq_api_key,
        )
    except Exception:
        return fallback_answer

    return {
        "answer": answer,
        "answer_source_label": "live-groq",
        "answer_source_state": AssistantSourceState.LIVE.value,
        "supported_question": True,
    }


def build_assessment_assistant_answer(payload: dict[str, object]) -> dict[str, object]:
    question = str(payload.get("question", "")).strip()
    forecast_window = str(payload.get("forecast_window", "")).strip()
    location_name = payload.get("location_name")
    assessment = payload.get("assessment")
    forecast_assessments = payload.get("forecast_assessments")

    if not question or not forecast_window or not isinstance(assessment, dict):
        return _unsupported_assistant_answer(
            "Assessment assistant is unavailable because the selected Forecast Window or assessment facts are missing."
        )

    normalized_question = question.lower()
    if _is_unsafe_operational_question(normalized_question):
        return _unsafe_operational_answer()
    if _is_out_of_scope_assistant_question(normalized_question):
        return _out_of_scope_assistant_answer()

    asks_for_comparison = any(
        phrase in normalized_question
        for phrase in ("increase", "decrease", "compare", "change", "trend", "why did risk")
    )

    if asks_for_comparison:
        if not isinstance(forecast_assessments, list) or not all(
            isinstance(item, dict) for item in forecast_assessments
        ):
            return _unsupported_assistant_answer(
                "Forecast Window comparison is unavailable because the required Forecast Window set is missing from the approved assessment facts."
            )
        fallback_answer = _build_window_comparison_answer(
            location_name=str(location_name) if location_name else None,
            forecast_window=forecast_window,
            forecast_assessments=forecast_assessments,
        )
        return _with_live_assistant_answer(
            question=question,
            original_payload=payload,
            fallback_answer=fallback_answer,
        )

    fallback_answer = _build_single_window_assistant_answer(
        question=question,
        location_name=str(location_name) if location_name else None,
        forecast_window=forecast_window,
        assessment=assessment,
    )
    return _with_live_assistant_answer(
        question=question,
        original_payload=payload,
        fallback_answer=fallback_answer,
    )


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
