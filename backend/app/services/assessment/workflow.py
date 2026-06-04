"""Deep assessment workflow for selected-location on-demand assessments."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Callable

from app.services.assessment.decision import DecisionSupportService, RiskTrend
from app.services.history.repository import HistoryRepositoryError
from app.services.weather.openweather import WeatherServiceError


class AssessmentServiceError(RuntimeError):
    """Raised when the assessment orchestration cannot produce a live result."""


@dataclass(frozen=True)
class AssessmentWorkflowDependencies:
    build_weather_window_payload: Callable[[float, float, list[str]], dict[str, object]]
    build_decision_support_service: Callable[[], DecisionSupportService]
    build_narrative_briefing: Callable[[dict[str, object]], dict[str, object]]
    save_history_record: Callable[..., str]
    replace_risk_alerts: Callable[..., list[str]]


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


def _fallback_model_explanation(prediction_inputs: dict[str, float]) -> dict[str, object]:
    impacts = [
        {
            "feature_name": feature_name,
            "feature_value": float(feature_value),
            "baseline_value": float(feature_value),
            "contribution_to_risk_score": 0.0,
            "direction": "neutral",
        }
        for feature_name, feature_value in prediction_inputs.items()
    ]
    return {
        "label": "Model behavior explanation (not causal proof).",
        "method": "runtime_feature_perturbation_v1",
        "uses_runtime_features_only": True,
        "feature_scope": list(prediction_inputs.keys()),
        "top_feature_impacts": impacts[:3],
        "limitations": [
            "Explanation describes model behavior on this feature vector, not proven real-world wildfire causality.",
        ],
    }


def build_on_demand_assessment(
    *,
    location: dict[str, object],
    forecast_windows: list[str],
    deps: AssessmentWorkflowDependencies,
) -> dict[str, object]:
    latitude = float(location["latitude"])
    longitude = float(location["longitude"])

    weather_payload = deps.build_weather_window_payload(
        latitude=latitude,
        longitude=longitude,
        forecast_windows=forecast_windows,
    )
    if weather_payload.get("source_state") != "live":
        raise AssessmentServiceError("Weather source is degraded; cannot create live assessment.")

    try:
        decision_support = deps.build_decision_support_service()
    except Exception as exc:
        if exc.__class__.__name__ != "ModelUnavailableError":
            raise
        return {
            "source_state": "degraded",
            "location": location,
            "forecast_assessments": [],
            "data_source_labels": {
                "assessment": "unavailable",
                "weather": weather_payload.get("data_source_label", "live"),
                "narrative": "unavailable",
            },
            "message": str(exc),
        }
    selected_algorithm = getattr(decision_support, "selected_algorithm", None)
    now = datetime.now(tz=UTC)

    narrative_labels: set[str] = set()
    forecast_assessments: list[dict[str, object]] = []
    risk_alerts: list[dict[str, object]] = []
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
        explain_feature_vector = getattr(decision_support, "explain_feature_vector", None)
        if callable(explain_feature_vector):
            model_explanation = explain_feature_vector(
                feature_values=prediction_inputs,
                feature_units=prediction_input_units,
                max_features=3,
            )
        else:
            model_explanation = _fallback_model_explanation(prediction_inputs)

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
        narrative = deps.build_narrative_briefing(narrative_payload)
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
                "risk_alert_status": (
                    "created"
                    if decision.risk_level in {"high", "critical"} and decision.risk_alert_expiry_hours is not None
                    else "not-created"
                ),
                "risk_alert_expiry_hours": decision.risk_alert_expiry_hours,
                "threshold_version": decision.threshold_version,
                "recommendation_rule_version": decision.recommendation_rule_version,
                "model_algorithm": selected_algorithm,
                "model_input_drivers": prediction_inputs,
                "model_explanation": model_explanation,
                "weather_signals": weather_window.get("weather_signals", {}),
                "narrative_explanation": narrative["narrative_explanation"],
                "narrative_source_label": narrative["narrative_source_label"],
            }
        )
        if decision.risk_level in {"high", "critical"} and decision.risk_alert_expiry_hours is not None:
            risk_alerts.append(
                {
                    "forecast_window": str(weather_window["forecast_window"]),
                    "risk_level": decision.risk_level,
                    "risk_score": round(decision.risk_score, 4),
                    "recommended_action": decision.recommended_action,
                    "recommendation_rule_version": decision.recommendation_rule_version,
                    "risk_alert_expiry_hours": decision.risk_alert_expiry_hours,
                }
            )
        previous_risk_score = decision.risk_score

    try:
        deps.replace_risk_alerts(location=location, alerts=risk_alerts)
    except Exception:
        # Alert persistence is best-effort; live assessment must still complete.
        pass

    narrative_label = "live" if narrative_labels == {"live"} else "fallback"
    data_source_labels = {
        "assessment": "live",
        "weather": weather_payload.get("data_source_label", "live"),
        "narrative": narrative_label,
    }

    response_payload = {
        "source_state": "live",
        "location": location,
        "forecast_assessments": forecast_assessments,
        "data_source_labels": data_source_labels,
        "model_algorithm": selected_algorithm,
        "message": None,
    }

    history_record_id: str | None = None
    try:
        history_record_id = deps.save_history_record(
            source_state="live",
            location=location,
            requested_forecast_windows=forecast_windows,
            data_source_labels=data_source_labels,
            forecast_assessments=forecast_assessments,
        )
    except HistoryRepositoryError:
        response_payload["message"] = "Assessment completed, but prediction history persistence is unavailable."

    response_payload["prediction_history_record_id"] = history_record_id
    return response_payload
