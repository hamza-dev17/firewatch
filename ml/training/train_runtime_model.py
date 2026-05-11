"""Train the runtime-compatible FIREWATCH prototype model artifact.

The deployed artifact intentionally uses only features that can be produced
from OpenWeather data at Turkish assessment time.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
import sys
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
sys.path.append(str(BACKEND_ROOT))

from app.services.features.runtime_contract import (  # noqa: E402
    RUNTIME_FEATURE_SCHEMA_VERSION,
    RUNTIME_FEATURE_UNITS,
    RUNTIME_FEATURES,
    TRAINING_ONLY_FEATURE_CATEGORIES,
)

DATASET_PATH = REPO_ROOT / "data" / "raw" / "Date_final_dataset_balanced_float32.parquet"
ARTIFACT_PATH = REPO_ROOT / "ml" / "artifacts" / "model.joblib"
METRICS_PATH = REPO_ROOT / "ml" / "metrics" / "runtime_model_evidence.json"

MODEL_VERSION = "runtime-morocco-proxy-v1"
DATASET_VERSION = "morocco-wildfire-balanced-float32-2010-2022"
THRESHOLD_VERSION = "runtime-morocco-proxy-v1-thresholds"
RANDOM_STATE = 42
MAX_TRAINING_ROWS = 120_000

SOURCE_COLUMNS = {
    "temperature_c": "average_temperature_lag_1",
    "temperature_min_c": "minimum_temperature_lag_1",
    "temperature_max_c": "maximum_temperature_lag_1",
    "rain_mm": "precipitation_lag_1",
    "wind_speed_mps": "wind_speed_lag_1",
    "wind_gust_mps": "wind_gust_lag_1",
}

TRANSFER_LIMITATION = (
    "Prototype Relative Wildfire Risk only: this artifact is trained on a Morocco Proxy Training Dataset, "
    "not Turkiye wildfire outcomes. It must not be described as official Turkiye wildfire accuracy, an "
    "official fire-danger class, or a validated probability of wildfire occurrence."
)


def _fahrenheit_to_celsius(series: pd.Series) -> pd.Series:
    return (series - 32.0) * 5.0 / 9.0


def _mph_to_mps(series: pd.Series) -> pd.Series:
    return series * 0.44704


def _inches_to_mm(series: pd.Series) -> pd.Series:
    return series * 25.4


def _clean_source_values(series: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce").astype("float64")
    return numeric.mask(numeric >= 999.0, np.nan)


def build_runtime_training_frame(raw_frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    frame = pd.DataFrame(index=raw_frame.index)
    frame["temperature_c"] = _fahrenheit_to_celsius(
        _clean_source_values(raw_frame[SOURCE_COLUMNS["temperature_c"]])
    )
    frame["temperature_min_c"] = _fahrenheit_to_celsius(
        _clean_source_values(raw_frame[SOURCE_COLUMNS["temperature_min_c"]])
    )
    frame["temperature_max_c"] = _fahrenheit_to_celsius(
        _clean_source_values(raw_frame[SOURCE_COLUMNS["temperature_max_c"]])
    )
    frame["rain_mm"] = _inches_to_mm(_clean_source_values(raw_frame[SOURCE_COLUMNS["rain_mm"]]))
    frame["wind_speed_mps"] = _mph_to_mps(
        _clean_source_values(raw_frame[SOURCE_COLUMNS["wind_speed_mps"]])
    )
    frame["wind_gust_mps"] = _mph_to_mps(_clean_source_values(raw_frame[SOURCE_COLUMNS["wind_gust_mps"]]))

    labels = pd.to_numeric(raw_frame["is_fire"], errors="coerce").fillna(0).astype(int)
    return frame.loc[:, list(RUNTIME_FEATURES)], labels


def _candidate_models() -> dict[str, Pipeline]:
    return {
        "logistic_regression": Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
                (
                    "classifier",
                    LogisticRegression(
                        class_weight="balanced",
                        max_iter=1000,
                        random_state=RANDOM_STATE,
                    ),
                ),
            ]
        ),
        "random_forest": Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "classifier",
                    RandomForestClassifier(
                        n_estimators=80,
                        min_samples_leaf=20,
                        class_weight="balanced_subsample",
                        n_jobs=1,
                        random_state=RANDOM_STATE,
                    ),
                ),
            ]
        ),
    }


def _metrics_for(model: Pipeline, x_test: pd.DataFrame, y_test: pd.Series) -> dict[str, Any]:
    probabilities = model.predict_proba(x_test)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)
    matrix = confusion_matrix(y_test, predictions, labels=[0, 1])
    return {
        "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
        "wildfire_precision": round(
            float(precision_score(y_test, predictions, zero_division=0)),
            4,
        ),
        "wildfire_recall": round(float(recall_score(y_test, predictions, zero_division=0)), 4),
        "wildfire_f1": round(float(f1_score(y_test, predictions, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, probabilities)), 4),
        "confusion_matrix": {
            "labels": ["no_fire", "wildfire"],
            "matrix": matrix.astype(int).tolist(),
        },
    }


def train_runtime_model() -> dict[str, Any]:
    raw_frame = pd.read_parquet(DATASET_PATH)
    features, labels = build_runtime_training_frame(raw_frame)

    if len(features) > MAX_TRAINING_ROWS:
        sample = features.assign(is_fire=labels).sample(
            n=MAX_TRAINING_ROWS,
            random_state=RANDOM_STATE,
        )
        labels = sample.pop("is_fire").astype(int)
        features = sample.loc[:, list(RUNTIME_FEATURES)]

    x_train, x_test, y_train, y_test = train_test_split(
        features,
        labels,
        test_size=0.25,
        stratify=labels,
        random_state=RANDOM_STATE,
    )

    candidate_evidence: dict[str, Any] = {}
    fitted_candidates: dict[str, Pipeline] = {}
    for name, model in _candidate_models().items():
        model.fit(x_train, y_train)
        fitted_candidates[name] = model
        candidate_evidence[name] = _metrics_for(model, x_test, y_test)

    selected_algorithm = sorted(
        candidate_evidence,
        key=lambda item: (
            candidate_evidence[item]["wildfire_recall"],
            candidate_evidence[item]["wildfire_f1"],
            candidate_evidence[item]["roc_auc"],
        ),
        reverse=True,
    )[0]
    selected_model = fitted_candidates[selected_algorithm]
    selected_metrics = candidate_evidence[selected_algorithm]

    score_thresholds = {
        "low_max": 0.33,
        "medium_max": 0.66,
        "high_max": 0.85,
        "critical_min": 0.85,
        "selection_note": (
            "Initial MVP thresholds are evidence inputs selected from proxy score distribution review; "
            "they are not official Turkiye fire-danger thresholds."
        ),
    }

    metadata: dict[str, Any] = {
        "model_version": MODEL_VERSION,
        "selected_algorithm": selected_algorithm,
        "training_date": datetime.now(tz=UTC).date().isoformat(),
        "dataset_source": "Morocco Wildfire Dataset",
        "dataset_version": DATASET_VERSION,
        "dataset_role": "Proxy Training Dataset",
        "runtime_feature_schema_version": RUNTIME_FEATURE_SCHEMA_VERSION,
        "feature_schema": list(RUNTIME_FEATURES),
        "unit_schema": dict(RUNTIME_FEATURE_UNITS),
        "source_columns": dict(SOURCE_COLUMNS),
        "source_column_note": (
            "The Morocco dataset's lag_1 weather columns are used as the closest available historical "
            "stand-ins for the deployed same-window OpenWeather runtime feature schema; lag_2 through "
            "lag_15 weather histories are excluded from the deployed artifact."
        ),
        "source_unit_conversions": {
            "temperature": "source Fahrenheit converted to Celsius",
            "precipitation": "source inches converted to millimeters",
            "wind": "source miles per hour converted to meters per second",
        },
        "training_only_feature_categories": list(TRAINING_ONLY_FEATURE_CATEGORIES),
        "excluded_feature_policy": (
            "Raw coordinates, station metadata, NDVI, SoilMoisture, lagged coordinates, multi-day "
            "weather lags, and long historical aggregate columns are excluded from the deployed predictor."
        ),
        "candidate_models": candidate_evidence,
        "validation_metrics": selected_metrics,
        "threshold_version": THRESHOLD_VERSION,
        "threshold_evidence_inputs": score_thresholds,
        "transfer_limitation": TRANSFER_LIMITATION,
        "accuracy_claim": "Prototype Relative Wildfire Risk; not official Turkiye operational accuracy.",
    }

    artifact = {"model": selected_model, "metadata": metadata}
    ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    METRICS_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, ARTIFACT_PATH)
    METRICS_PATH.write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return metadata


if __name__ == "__main__":
    evidence = train_runtime_model()
    print(json.dumps({"model_version": evidence["model_version"], "selected_algorithm": evidence["selected_algorithm"]}))
