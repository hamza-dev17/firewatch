from pathlib import Path
import sys

import pandas as pd

sys.path.append(str(Path(__file__).resolve().parents[2] / "ml" / "training"))

from train_runtime_model import (  # noqa: E402
    grouped_runtime_validation_split,
    runtime_feature_hashes,
)


def test_grouped_runtime_validation_split_prevents_duplicate_feature_hash_leakage() -> None:
    features = pd.DataFrame(
        [
            {
                "temperature_c": 30.0,
                "temperature_min_c": 24.0,
                "temperature_max_c": 35.0,
                "rain_mm": 0.0,
                "wind_speed_mps": 5.0,
                "wind_gust_mps": 8.0,
            },
            {
                "temperature_c": 30.0,
                "temperature_min_c": 24.0,
                "temperature_max_c": 35.0,
                "rain_mm": 0.0,
                "wind_speed_mps": 5.0,
                "wind_gust_mps": 8.0,
            },
            {
                "temperature_c": 41.0,
                "temperature_min_c": 31.0,
                "temperature_max_c": 44.0,
                "rain_mm": 0.0,
                "wind_speed_mps": 12.0,
                "wind_gust_mps": 18.0,
            },
            {
                "temperature_c": 18.0,
                "temperature_min_c": 12.0,
                "temperature_max_c": 23.0,
                "rain_mm": 5.0,
                "wind_speed_mps": 2.0,
                "wind_gust_mps": 4.0,
            },
            {
                "temperature_c": 26.0,
                "temperature_min_c": 20.0,
                "temperature_max_c": 29.0,
                "rain_mm": 1.0,
                "wind_speed_mps": 3.0,
                "wind_gust_mps": 5.0,
            },
        ]
    )
    labels = pd.Series([0, 1, 1, 0, 0])

    split = grouped_runtime_validation_split(features, labels, test_size=0.4, random_state=7)
    hashes = runtime_feature_hashes(features)

    train_hashes = set(hashes.iloc[split.x_train.index])
    validation_hashes = set(hashes.iloc[split.x_validation.index])

    assert train_hashes.isdisjoint(validation_hashes)


def test_runtime_feature_hashes_handle_missing_runtime_values() -> None:
    features = pd.DataFrame(
        [
            {
                "temperature_c": 30.0,
                "temperature_min_c": 24.0,
                "temperature_max_c": 35.0,
                "rain_mm": 0.0,
                "wind_speed_mps": 5.0,
                "wind_gust_mps": None,
            }
        ]
    )

    hashes = runtime_feature_hashes(features)

    assert len(hashes.iloc[0]) == 64
