from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.config import REPO_ROOT
from app.services.assessment.decision import DecisionSupportService, RiskTrend


def test_decision_support_service_predicts_and_returns_confidence_when_available() -> None:
    service = DecisionSupportService.from_artifact_path(REPO_ROOT / "ml" / "artifacts" / "model.joblib")

    result = service.assess_feature_vector(
        feature_values={
            "temperature_c": 32.0,
            "temperature_min_c": 24.0,
            "temperature_max_c": 38.0,
            "rain_mm": 0.0,
            "wind_speed_mps": 7.0,
            "wind_gust_mps": 12.0,
        },
        feature_units={
            "temperature_c": "C",
            "temperature_min_c": "C",
            "temperature_max_c": "C",
            "rain_mm": "mm",
            "wind_speed_mps": "m/s",
            "wind_gust_mps": "m/s",
        },
        risk_trend=RiskTrend.STABLE,
        data_freshness_minutes=30,
    )

    assert 0.0 <= result.risk_score <= 1.0
    assert result.model_confidence is not None
    assert result.risk_level in {"low", "medium", "high", "critical"}
    assert result.threshold_version == "runtime-morocco-proxy-v1-thresholds"


def test_decision_support_service_applies_threshold_boundaries_from_model_evidence() -> None:
    service = DecisionSupportService.from_artifact_path(REPO_ROOT / "ml" / "artifacts" / "model.joblib")

    assert (
        service.assess_risk_score(0.33, None, RiskTrend.STABLE, 30).risk_level
        == "low"
    )
    assert (
        service.assess_risk_score(0.3301, None, RiskTrend.STABLE, 30).risk_level
        == "medium"
    )
    assert (
        service.assess_risk_score(0.66, None, RiskTrend.STABLE, 30).risk_level
        == "medium"
    )
    assert (
        service.assess_risk_score(0.6601, None, RiskTrend.STABLE, 30).risk_level
        == "high"
    )
    assert (
        service.assess_risk_score(0.85, None, RiskTrend.STABLE, 30).risk_level
        == "critical"
    )


def test_decision_support_service_maps_risk_levels_to_recommendations_radius_and_alert_expiry() -> None:
    service = DecisionSupportService.from_artifact_path(REPO_ROOT / "ml" / "artifacts" / "model.joblib")

    low = service.assess_risk_score(0.20, None, RiskTrend.STABLE, 30)
    medium = service.assess_risk_score(0.50, None, RiskTrend.STABLE, 30)
    high = service.assess_risk_score(0.70, None, RiskTrend.STABLE, 30)
    critical = service.assess_risk_score(0.90, None, RiskTrend.STABLE, 30)

    assert low.recommendation_rule_version == "mvp-v1-recommendation-rules"

    assert (low.risk_level, low.recommended_action, low.monitoring_radius, low.risk_alert_expiry_hours) == (
        "low",
        "routine monitoring",
        "5 km",
        None,
    )
    assert (
        medium.risk_level,
        medium.recommended_action,
        medium.monitoring_radius,
        medium.risk_alert_expiry_hours,
    ) == (
        "medium",
        "increase weather review",
        "10 km",
        None,
    )
    assert (high.risk_level, high.recommended_action, high.monitoring_radius, high.risk_alert_expiry_hours) == (
        "high",
        "prioritize local inspection",
        "20 km",
        24,
    )
    assert (
        critical.risk_level,
        critical.recommended_action,
        critical.monitoring_radius,
        critical.risk_alert_expiry_hours,
    ) == (
        "critical",
        "immediate supervisor review",
        "30 km",
        12,
    )


def test_decision_support_service_derives_priority_rank_from_level_score_trend_and_freshness() -> None:
    service = DecisionSupportService.from_artifact_path(REPO_ROOT / "ml" / "artifacts" / "model.joblib")

    higher_priority = service.assess_risk_score(
        risk_score=0.82,
        model_confidence=None,
        risk_trend=RiskTrend.RISING,
        data_freshness_minutes=25,
    )
    lower_priority = service.assess_risk_score(
        risk_score=0.82,
        model_confidence=None,
        risk_trend=RiskTrend.DECREASING,
        data_freshness_minutes=260,
    )

    assert higher_priority.priority_score > lower_priority.priority_score
    assert higher_priority.priority_rank < lower_priority.priority_rank
    assert higher_priority.priority_factors["risk_trend"] == "rising"
    assert lower_priority.priority_factors["data_freshness_state"] == "old"
    assert higher_priority.priority_factors["risk_level"] == higher_priority.risk_level
    assert higher_priority.priority_factors["risk_score"] == round(higher_priority.risk_score, 4)
