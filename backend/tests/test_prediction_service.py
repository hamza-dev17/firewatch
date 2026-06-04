from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.config import REPO_ROOT
from app.services.features.runtime_contract import TRAINING_ONLY_FEATURE_CATEGORIES
import pytest

from app.services.prediction.service import PredictionService, PredictionServiceError


class _PredictOnlyModel:
    def predict(self, frame):  # noqa: ANN001
        return [1]


class _ProbabilityModel:
    classes_ = [0, 1]

    def __init__(self, wildfire_probability: float) -> None:
        self.wildfire_probability = wildfire_probability

    def predict_proba(self, frame):  # noqa: ANN001
        return [[1.0 - self.wildfire_probability, self.wildfire_probability]]


def _metadata(selected_algorithm: str = "default_model") -> dict[str, object]:
    return {
        "model_version": "test-model-v1",
        "selected_algorithm": selected_algorithm,
        "feature_schema": [
            "temperature_c",
            "temperature_min_c",
            "temperature_max_c",
            "rain_mm",
            "wind_speed_mps",
            "wind_gust_mps",
        ],
        "unit_schema": {
            "temperature_c": "C",
            "temperature_min_c": "C",
            "temperature_max_c": "C",
            "rain_mm": "mm",
            "wind_speed_mps": "m/s",
            "wind_gust_mps": "m/s",
        },
    }


def _metadata_with_serving_models(selected_algorithm: str = "default_model") -> dict[str, object]:
    metadata = _metadata(selected_algorithm=selected_algorithm)
    metadata["serving_models"] = [selected_algorithm]
    metadata["candidate_models"] = {
        selected_algorithm: {"serving_enabled": True},
        "alternate_model": {"serving_enabled": False},
    }
    return metadata


def _feature_values() -> dict[str, float]:
    return {
        "temperature_c": 30.0,
        "temperature_min_c": 25.0,
        "temperature_max_c": 35.0,
        "rain_mm": 0.0,
        "wind_speed_mps": 5.0,
        "wind_gust_mps": 7.0,
    }


def _feature_units() -> dict[str, str]:
    return {
        "temperature_c": "C",
        "temperature_min_c": "C",
        "temperature_max_c": "C",
        "rain_mm": "mm",
        "wind_speed_mps": "m/s",
        "wind_gust_mps": "m/s",
    }


def test_selected_model_artifact_loads_and_predicts_through_runtime_service() -> None:
    service = PredictionService.from_artifact_path(REPO_ROOT / "ml" / "artifacts" / "model.joblib")

    prediction = service.predict(
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
    )

    assert prediction.model_version == "runtime-morocco-proxy-v1"
    assert 0.0 <= prediction.risk_score <= 1.0
    assert prediction.feature_schema == [
        "temperature_c",
        "temperature_min_c",
        "temperature_max_c",
        "rain_mm",
        "wind_speed_mps",
        "wind_gust_mps",
    ]


def test_selected_model_artifact_documents_and_excludes_training_only_features() -> None:
    service = PredictionService.from_artifact_path(REPO_ROOT / "ml" / "artifacts" / "model.joblib")
    metadata = service.metadata

    excluded_fragments = [
        "latitude",
        "longitude",
        "station",
        "NDVI",
        "SoilMoisture",
        "lag_2",
        "lag_15",
        "yearly_mean",
    ]

    assert metadata["training_only_feature_categories"] == list(TRAINING_ONLY_FEATURE_CATEGORIES)
    assert metadata["dataset_role"] == "Proxy Training Dataset"
    assert metadata["accuracy_claim"] == "Prototype Relative Wildfire Risk; not official Turkiye operational accuracy."
    assert all(
        fragment.lower() not in feature_name.lower()
        for feature_name in metadata["feature_schema"]
        for fragment in excluded_fragments
    )


def test_prediction_service_omits_model_confidence_when_model_does_not_expose_probability() -> None:
    service = PredictionService(
        {
            "model": _PredictOnlyModel(),
            "metadata": _metadata(selected_algorithm="predict-only-model"),
        }
    )

    prediction = service.predict(
        feature_values=_feature_values(),
        feature_units=_feature_units(),
    )

    assert prediction.risk_score == 1.0
    assert prediction.model_confidence is None


def test_prediction_service_can_select_serving_enabled_candidate_model() -> None:
    service = PredictionService(
        {
            "model": _ProbabilityModel(0.2),
            "models": {
                "default_model": _ProbabilityModel(0.2),
                "alternate_model": _ProbabilityModel(0.8),
            },
            "metadata": {
                **_metadata_with_serving_models(),
                "serving_models": ["default_model", "alternate_model"],
                "candidate_models": {
                    "default_model": {"serving_enabled": True},
                    "alternate_model": {"serving_enabled": True},
                },
            },
        },
        algorithm="alternate_model",
    )

    prediction = service.predict(
        feature_values=_feature_values(),
        feature_units=_feature_units(),
    )

    assert prediction.selected_algorithm == "alternate_model"
    assert prediction.risk_score == 0.8


def test_prediction_service_rejects_packaged_candidate_that_is_not_serving_enabled() -> None:
    with pytest.raises(PredictionServiceError, match="not enabled for live assessment"):
        PredictionService(
            {
                "model": _ProbabilityModel(0.2),
                "models": {
                    "default_model": _ProbabilityModel(0.2),
                    "alternate_model": _ProbabilityModel(0.8),
                },
                "metadata": _metadata_with_serving_models(),
            },
            algorithm="alternate_model",
        )


def test_prediction_service_returns_runtime_feature_model_behavior_explanation() -> None:
    service = PredictionService.from_artifact_path(REPO_ROOT / "ml" / "artifacts" / "model.joblib")

    explanation = service.explain(
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
        max_features=3,
    )

    assert explanation["label"] == "Model behavior explanation (not causal proof)."
    assert explanation["method"] == "runtime_feature_perturbation_v1"
    assert explanation["uses_runtime_features_only"] is True
    assert explanation["feature_scope"] == [
        "temperature_c",
        "temperature_min_c",
        "temperature_max_c",
        "rain_mm",
        "wind_speed_mps",
        "wind_gust_mps",
    ]
    assert len(explanation["top_feature_impacts"]) == 3
    assert all("feature_name" in impact for impact in explanation["top_feature_impacts"])
    assert all("contribution_to_risk_score" in impact for impact in explanation["top_feature_impacts"])
    assert all("feature_value" in impact for impact in explanation["top_feature_impacts"])
    assert all("baseline_value" in impact for impact in explanation["top_feature_impacts"])
    assert all(
        impact["direction"] in {"increases_risk", "decreases_risk", "neutral"}
        for impact in explanation["top_feature_impacts"]
    )
    assert any("Proxy Training Dataset" in item for item in explanation["limitations"])
