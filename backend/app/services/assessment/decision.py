"""Prediction + classification + recommendation decision boundary."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any

from app.services.prediction.service import PredictionService


class RiskTrend(str, Enum):
    RISING = "rising"
    STABLE = "stable"
    DECREASING = "decreasing"


@dataclass(frozen=True)
class RiskDecision:
    risk_score: float
    model_confidence: float | None
    risk_level: str
    threshold_version: str
    recommended_action: str
    monitoring_radius: str
    risk_alert_expiry_hours: int | None
    recommendation_rule_version: str
    priority_score: float
    priority_rank: str
    priority_factors: dict[str, object]


@dataclass(frozen=True)
class _ThresholdConfig:
    low_max: float
    medium_max: float
    critical_min: float
    version: str


_RECOMMENDATION_RULE_VERSION = "mvp-v1-recommendation-rules"
_RECOMMENDATIONS = {
    "low": ("routine monitoring", "5 km", None),
    "medium": ("increase weather review", "10 km", None),
    "high": ("prioritize local inspection", "20 km", 24),
    "critical": ("immediate supervisor review", "30 km", 12),
}


class DecisionSupportService:
    """Backend source of truth for score classification and action mapping."""

    def __init__(self, prediction_service: PredictionService) -> None:
        self._prediction_service = prediction_service
        self._thresholds = _thresholds_from_metadata(
            prediction_service.metadata,
            selected_algorithm=prediction_service.selected_algorithm,
        )

    @classmethod
    def from_artifact_path(cls, artifact_path: Path, algorithm: str | None = None) -> "DecisionSupportService":
        prediction_service = PredictionService.from_artifact_path(artifact_path, algorithm=algorithm)
        return cls(prediction_service)

    @property
    def selected_algorithm(self) -> str:
        return self._prediction_service.selected_algorithm

    def assess_feature_vector(
        self,
        feature_values: dict[str, float],
        feature_units: dict[str, str],
        risk_trend: RiskTrend,
        data_freshness_minutes: int,
    ) -> RiskDecision:
        prediction = self._prediction_service.predict(
            feature_values=feature_values,
            feature_units=feature_units,
        )
        return self.assess_risk_score(
            risk_score=prediction.risk_score,
            model_confidence=prediction.model_confidence,
            risk_trend=risk_trend,
            data_freshness_minutes=data_freshness_minutes,
        )

    def assess_risk_score(
        self,
        risk_score: float,
        model_confidence: float | None,
        risk_trend: RiskTrend,
        data_freshness_minutes: int,
    ) -> RiskDecision:
        risk_level = classify_risk_level(risk_score, self._thresholds)
        recommended_action, monitoring_radius, expiry_hours = _RECOMMENDATIONS[risk_level]

        priority_score, priority_rank, priority_factors = _priority_from_inputs(
            risk_level=risk_level,
            risk_score=risk_score,
            risk_trend=risk_trend,
            data_freshness_minutes=data_freshness_minutes,
        )

        return RiskDecision(
            risk_score=risk_score,
            model_confidence=model_confidence,
            risk_level=risk_level,
            threshold_version=self._thresholds.version,
            recommended_action=recommended_action,
            monitoring_radius=monitoring_radius,
            risk_alert_expiry_hours=expiry_hours,
            recommendation_rule_version=_RECOMMENDATION_RULE_VERSION,
            priority_score=priority_score,
            priority_rank=priority_rank,
            priority_factors=priority_factors,
        )

    def explain_feature_vector(
        self,
        feature_values: dict[str, float],
        feature_units: dict[str, str],
        max_features: int = 3,
    ) -> dict[str, object]:
        return self._prediction_service.explain(
            feature_values=feature_values,
            feature_units=feature_units,
            max_features=max_features,
        )


def _thresholds_from_metadata(metadata: dict[str, Any], selected_algorithm: str | None = None) -> _ThresholdConfig:
    model_thresholds = metadata.get("model_thresholds")
    if selected_algorithm and isinstance(model_thresholds, dict):
        selected_thresholds = model_thresholds.get(selected_algorithm)
        if isinstance(selected_thresholds, dict):
            return _threshold_config_from_mapping(
                selected_thresholds,
                version=str(metadata.get("threshold_version", "runtime-default-thresholds")),
            )

    evidence_inputs = metadata.get("threshold_evidence_inputs", {})
    if not isinstance(evidence_inputs, dict):
        evidence_inputs = {}

    return _threshold_config_from_mapping(
        evidence_inputs,
        version=str(metadata.get("threshold_version", "runtime-default-thresholds")),
    )


def _threshold_config_from_mapping(mapping: dict[str, Any], version: str) -> _ThresholdConfig:
    low_max = float(mapping.get("low_max", 0.33))
    medium_max = float(mapping.get("medium_max", 0.66))
    critical_min = float(mapping.get("critical_min", 0.85))
    return _ThresholdConfig(
        low_max=low_max,
        medium_max=medium_max,
        critical_min=critical_min,
        version=version,
    )


def classify_risk_level(risk_score: float, thresholds: _ThresholdConfig) -> str:
    if risk_score <= thresholds.low_max:
        return "low"
    if risk_score <= thresholds.medium_max:
        return "medium"
    if risk_score < thresholds.critical_min:
        return "high"
    return "critical"


def _priority_from_inputs(
    risk_level: str,
    risk_score: float,
    risk_trend: RiskTrend,
    data_freshness_minutes: int,
) -> tuple[float, str, dict[str, object]]:
    level_points = {
        "low": 15.0,
        "medium": 40.0,
        "high": 70.0,
        "critical": 90.0,
    }[risk_level]
    trend_points = {
        RiskTrend.DECREASING: 0.0,
        RiskTrend.STABLE: 3.0,
        RiskTrend.RISING: 8.0,
    }[risk_trend]

    if data_freshness_minutes <= 60:
        freshness_points = 0.0
        freshness_state = "fresh"
    elif data_freshness_minutes <= 180:
        freshness_points = -5.0
        freshness_state = "stale"
    else:
        freshness_points = -15.0
        freshness_state = "old"

    score_points = max(0.0, min(10.0, risk_score * 10.0))
    priority_score = max(0.0, min(100.0, level_points + score_points + trend_points + freshness_points))

    if priority_score >= 85.0:
        priority_rank = "P1"
    elif priority_score >= 65.0:
        priority_rank = "P2"
    elif priority_score >= 45.0:
        priority_rank = "P3"
    else:
        priority_rank = "P4"

    factors = {
        "risk_level": risk_level,
        "risk_score": round(risk_score, 4),
        "risk_trend": risk_trend.value,
        "data_freshness_minutes": data_freshness_minutes,
        "data_freshness_state": freshness_state,
        "level_points": level_points,
        "score_points": round(score_points, 4),
        "trend_points": trend_points,
        "freshness_points": freshness_points,
    }
    return priority_score, priority_rank, factors
