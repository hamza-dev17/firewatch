from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.config import REPO_ROOT
from app.services.features.runtime_contract import TRAINING_ONLY_FEATURE_CATEGORIES
from app.services.prediction.service import PredictionService


class _PredictOnlyModel:
    def predict(self, frame):  # noqa: ANN001
        return [1]


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
            "metadata": {
                "model_version": "test-model-v1",
                "selected_algorithm": "predict-only-model",
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
            },
        }
    )

    prediction = service.predict(
        feature_values={
            "temperature_c": 30.0,
            "temperature_min_c": 25.0,
            "temperature_max_c": 35.0,
            "rain_mm": 0.0,
            "wind_speed_mps": 5.0,
            "wind_gust_mps": 7.0,
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

    assert prediction.risk_score == 1.0
    assert prediction.model_confidence is None
