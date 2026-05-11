"""Runtime feature contract metadata for deployed FIREWATCH MVP prediction."""

from __future__ import annotations

from collections.abc import Mapping

RUNTIME_FEATURE_SCHEMA_VERSION = "mvp-v1"

RUNTIME_FEATURES = (
    "temperature_c",
    "temperature_min_c",
    "temperature_max_c",
    "rain_mm",
    "wind_speed_mps",
    "wind_gust_mps",
)

RUNTIME_FEATURE_UNITS = {
    "temperature_c": "C",
    "temperature_min_c": "C",
    "temperature_max_c": "C",
    "rain_mm": "mm",
    "wind_speed_mps": "m/s",
    "wind_gust_mps": "m/s",
}

TRAINING_ONLY_FEATURE_CATEGORIES = (
    "raw_coordinates",
    "station_metadata",
    "lagged_coordinate_fields",
    "multi_day_weather_lags",
    "ndvi",
    "soil_moisture",
    "long_historical_aggregates",
)


def build_runtime_feature_contract_payload() -> dict[str, object]:
    return {
        "schema_version": RUNTIME_FEATURE_SCHEMA_VERSION,
        "runtime_features": list(RUNTIME_FEATURES),
        "units": dict(RUNTIME_FEATURE_UNITS),
        "training_only_feature_categories": list(TRAINING_ONLY_FEATURE_CATEGORIES),
    }


def validate_runtime_feature_vector(
    feature_values: Mapping[str, float],
    feature_units: Mapping[str, str],
) -> None:
    feature_names = set(feature_values.keys())
    expected_features = set(RUNTIME_FEATURES)

    missing_features = sorted(expected_features - feature_names)
    if missing_features:
        missing = ", ".join(missing_features)
        raise ValueError(f"runtime feature contract validation failed: missing features: {missing}")

    extra_features = sorted(feature_names - expected_features)
    if extra_features:
        extra = ", ".join(extra_features)
        raise ValueError(f"runtime feature contract validation failed: extra features: {extra}")

    wrong_units: list[str] = []
    for feature_name in RUNTIME_FEATURES:
        expected_unit = RUNTIME_FEATURE_UNITS[feature_name]
        actual_unit = feature_units.get(feature_name)
        if actual_unit != expected_unit:
            wrong_units.append(f"{feature_name} expected {expected_unit} got {actual_unit}")

    if wrong_units:
        details = "; ".join(wrong_units)
        raise ValueError(f"runtime feature contract validation failed: wrong units: {details}")
