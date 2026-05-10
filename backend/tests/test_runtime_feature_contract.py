from pathlib import Path
import sys

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.features.runtime_contract import validate_runtime_feature_vector


def test_runtime_feature_validation_accepts_contract_vector() -> None:
    validate_runtime_feature_vector(
        feature_values={
            "temperature_c": 30.0,
            "temperature_min_c": 24.0,
            "temperature_max_c": 33.0,
            "rain_mm": 0.0,
            "wind_speed_mps": 5.5,
            "wind_gust_mps": 8.0,
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


def test_runtime_feature_validation_rejects_missing_features() -> None:
    with pytest.raises(ValueError, match="missing features"):
        validate_runtime_feature_vector(
            feature_values={
                "temperature_c": 30.0,
                "temperature_min_c": 24.0,
                "temperature_max_c": 33.0,
                "rain_mm": 0.0,
                "wind_speed_mps": 5.5,
            },
            feature_units={
                "temperature_c": "C",
                "temperature_min_c": "C",
                "temperature_max_c": "C",
                "rain_mm": "mm",
                "wind_speed_mps": "m/s",
            },
        )


def test_runtime_feature_validation_rejects_extra_features() -> None:
    with pytest.raises(ValueError, match="extra features"):
        validate_runtime_feature_vector(
            feature_values={
                "temperature_c": 30.0,
                "temperature_min_c": 24.0,
                "temperature_max_c": 33.0,
                "rain_mm": 0.0,
                "wind_speed_mps": 5.5,
                "wind_gust_mps": 8.0,
                "humidity_pct": 45.0,
            },
            feature_units={
                "temperature_c": "C",
                "temperature_min_c": "C",
                "temperature_max_c": "C",
                "rain_mm": "mm",
                "wind_speed_mps": "m/s",
                "wind_gust_mps": "m/s",
                "humidity_pct": "%",
            },
        )


def test_runtime_feature_validation_rejects_wrong_units() -> None:
    with pytest.raises(ValueError, match="wrong units"):
        validate_runtime_feature_vector(
            feature_values={
                "temperature_c": 30.0,
                "temperature_min_c": 24.0,
                "temperature_max_c": 33.0,
                "rain_mm": 0.0,
                "wind_speed_mps": 5.5,
                "wind_gust_mps": 8.0,
            },
            feature_units={
                "temperature_c": "K",
                "temperature_min_c": "C",
                "temperature_max_c": "C",
                "rain_mm": "mm",
                "wind_speed_mps": "m/s",
                "wind_gust_mps": "m/s",
            },
        )
