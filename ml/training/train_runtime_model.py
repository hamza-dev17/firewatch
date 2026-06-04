"""Train the runtime-compatible FIREWATCH prototype model artifact.

The deployed artifact intentionally uses only features that can be produced
from Weather API Source data at Turkish assessment time.
"""

from __future__ import annotations

import json
import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
import sys
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import (
    ExtraTreesClassifier,
    GradientBoostingClassifier,
    RandomForestClassifier,
    StackingClassifier,
    VotingClassifier,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    log_loss,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

try:
    from xgboost import XGBClassifier
except ImportError:
    XGBClassifier = None

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
CALIBRATION_TOP_K = 2
CALIBRATION_ELIGIBLE_MODELS = {
    "logistic_regression",
    "random_forest",
    "extra_trees",
    "gradient_boosting",
    "xgboost",
}

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


@dataclass(frozen=True)
class RuntimeValidationSplit:
    x_train: pd.DataFrame
    x_validation: pd.DataFrame
    y_train: pd.Series
    y_validation: pd.Series
    train_feature_hashes: list[str]
    validation_feature_hashes: list[str]


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


def runtime_feature_hashes(features: pd.DataFrame) -> pd.Series:
    runtime_frame = features.loc[:, list(RUNTIME_FEATURES)].copy()
    normalized = runtime_frame.round(6).astype(object).where(pd.notna(runtime_frame), None)

    def _hash_row(row: pd.Series) -> str:
        payload = json.dumps(row.to_dict(), sort_keys=True, separators=(",", ":"), allow_nan=False)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    return normalized.apply(_hash_row, axis=1)


def grouped_runtime_validation_split(
    features: pd.DataFrame,
    labels: pd.Series,
    test_size: float = 0.25,
    random_state: int = RANDOM_STATE,
) -> RuntimeValidationSplit:
    feature_hashes = runtime_feature_hashes(features)
    splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=random_state)
    train_index, validation_index = next(splitter.split(features, labels, groups=feature_hashes))

    x_train = features.iloc[train_index].copy()
    x_validation = features.iloc[validation_index].copy()
    y_train = labels.iloc[train_index].copy()
    y_validation = labels.iloc[validation_index].copy()
    train_hashes = set(feature_hashes.iloc[train_index])
    validation_hashes = set(feature_hashes.iloc[validation_index])
    overlap = train_hashes.intersection(validation_hashes)
    if overlap:
        raise RuntimeError("Grouped validation split leaked duplicate runtime feature vectors.")

    return RuntimeValidationSplit(
        x_train=x_train,
        x_validation=x_validation,
        y_train=y_train,
        y_validation=y_validation,
        train_feature_hashes=sorted(train_hashes),
        validation_feature_hashes=sorted(validation_hashes),
    )


def _candidate_models() -> dict[str, Pipeline]:
    candidates = {
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
        "extra_trees": Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "classifier",
                    ExtraTreesClassifier(
                        n_estimators=160,
                        min_samples_leaf=12,
                        class_weight="balanced",
                        n_jobs=1,
                        random_state=RANDOM_STATE,
                    ),
                ),
            ]
        ),
        "gradient_boosting": Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "classifier",
                    GradientBoostingClassifier(
                        n_estimators=140,
                        learning_rate=0.06,
                        max_depth=3,
                        random_state=RANDOM_STATE,
                    ),
                ),
            ]
        ),
        "soft_voting_hybrid": Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "classifier",
                    VotingClassifier(
                        estimators=[
                            (
                                "logistic_regression",
                                LogisticRegression(
                                    class_weight="balanced",
                                    max_iter=1000,
                                    random_state=RANDOM_STATE,
                                ),
                            ),
                            (
                                "random_forest",
                                RandomForestClassifier(
                                    n_estimators=80,
                                    min_samples_leaf=20,
                                    class_weight="balanced_subsample",
                                    n_jobs=1,
                                    random_state=RANDOM_STATE,
                                ),
                            ),
                            (
                                "extra_trees",
                                ExtraTreesClassifier(
                                    n_estimators=120,
                                    min_samples_leaf=12,
                                    class_weight="balanced",
                                    n_jobs=1,
                                    random_state=RANDOM_STATE,
                                ),
                            ),
                            (
                                "gradient_boosting",
                                GradientBoostingClassifier(
                                    n_estimators=120,
                                    learning_rate=0.06,
                                    max_depth=3,
                                    random_state=RANDOM_STATE,
                                ),
                            ),
                        ],
                        voting="soft",
                        n_jobs=1,
                    ),
                ),
            ]
        ),
        "stacking_hybrid": Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "classifier",
                    StackingClassifier(
                        estimators=[
                            (
                                "random_forest",
                                RandomForestClassifier(
                                    n_estimators=80,
                                    min_samples_leaf=20,
                                    class_weight="balanced_subsample",
                                    n_jobs=1,
                                    random_state=RANDOM_STATE,
                                ),
                            ),
                            (
                                "extra_trees",
                                ExtraTreesClassifier(
                                    n_estimators=120,
                                    min_samples_leaf=12,
                                    class_weight="balanced",
                                    n_jobs=1,
                                    random_state=RANDOM_STATE,
                                ),
                            ),
                            (
                                "gradient_boosting",
                                GradientBoostingClassifier(
                                    n_estimators=120,
                                    learning_rate=0.06,
                                    max_depth=3,
                                    random_state=RANDOM_STATE,
                                ),
                            ),
                        ],
                        final_estimator=LogisticRegression(
                            class_weight="balanced",
                            max_iter=1000,
                            random_state=RANDOM_STATE,
                        ),
                        cv=3,
                        n_jobs=1,
                    ),
                ),
            ]
        ),
    }

    if XGBClassifier is not None:
        candidates["xgboost"] = Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                (
                    "classifier",
                    XGBClassifier(
                        n_estimators=180,
                        learning_rate=0.06,
                        max_depth=4,
                        subsample=0.9,
                        colsample_bytree=0.9,
                        eval_metric="logloss",
                        n_jobs=1,
                        random_state=RANDOM_STATE,
                    ),
                ),
            ]
        )

    return candidates


def _metrics_for(model: Any, x_test: pd.DataFrame, y_test: pd.Series) -> dict[str, Any]:
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


def _classify_scores(probabilities: np.ndarray, thresholds: dict[str, float]) -> list[str]:
    risk_levels: list[str] = []
    for probability in probabilities:
        if probability <= thresholds["low_max"]:
            risk_levels.append("low")
        elif probability <= thresholds["medium_max"]:
            risk_levels.append("medium")
        elif probability < thresholds["critical_min"]:
            risk_levels.append("high")
        else:
            risk_levels.append("critical")
    return risk_levels


def _calibration_diagnostics(
    model: Any,
    x_test: pd.DataFrame,
    y_test: pd.Series,
    thresholds: dict[str, float],
) -> dict[str, Any]:
    probabilities = model.predict_proba(x_test)[:, 1]
    bins: list[dict[str, Any]] = []
    for start, end in zip(np.linspace(0.0, 0.8, 5), np.linspace(0.2, 1.0, 5), strict=True):
        mask = (probabilities >= start) & (probabilities <= end if end == 1.0 else probabilities < end)
        count = int(mask.sum())
        observed = float(y_test[mask].mean()) if count else None
        mean_score = float(probabilities[mask].mean()) if count else None
        bins.append(
            {
                "score_min": round(float(start), 2),
                "score_max": round(float(end), 2),
                "count": count,
                "mean_score": None if mean_score is None else round(mean_score, 4),
                "observed_wildfire_rate": None if observed is None else round(observed, 4),
            }
        )

    quantiles = np.quantile(probabilities, [0.05, 0.25, 0.5, 0.75, 0.95])
    risk_levels = _classify_scores(probabilities, thresholds)
    risk_distribution = {
        level: round(risk_levels.count(level) / len(risk_levels), 4)
        for level in ["low", "medium", "high", "critical"]
    }

    return {
        "brier_score": round(float(brier_score_loss(y_test, probabilities)), 4),
        "log_loss": round(float(log_loss(y_test, probabilities, labels=[0, 1])), 4),
        "calibration_bins": bins,
        "score_quantiles": {
            "p05": round(float(quantiles[0]), 4),
            "p25": round(float(quantiles[1]), 4),
            "p50": round(float(quantiles[2]), 4),
            "p75": round(float(quantiles[3]), 4),
            "p95": round(float(quantiles[4]), 4),
        },
        "risk_level_distribution": risk_distribution,
        "calibration_warning": (
            "Proxy validation probabilities are diagnostic only and are not validated Turkiye wildfire probabilities."
        ),
    }


def _candidate_disagreement(
    fitted_candidates: dict[str, Any],
    x_test: pd.DataFrame,
    thresholds: dict[str, float],
) -> dict[str, Any]:
    if len(fitted_candidates) < 2:
        return {
            "mean_score_spread": 0.0,
            "risk_level_disagreement_rate": 0.0,
            "low_to_critical_disagreement_rate": 0.0,
        }

    scores_by_model = {
        name: model.predict_proba(x_test)[:, 1]
        for name, model in fitted_candidates.items()
    }
    score_matrix = np.column_stack(list(scores_by_model.values()))
    spread = score_matrix.max(axis=1) - score_matrix.min(axis=1)
    levels_by_model = {
        name: _classify_scores(scores, thresholds)
        for name, scores in scores_by_model.items()
    }
    rows = list(zip(*levels_by_model.values(), strict=True))
    disagreement_count = sum(1 for row in rows if len(set(row)) > 1)
    low_to_critical_count = sum(1 for row in rows if "low" in row and "critical" in row)

    return {
        "mean_score_spread": round(float(spread.mean()), 4),
        "risk_level_disagreement_rate": round(disagreement_count / len(rows), 4),
        "low_to_critical_disagreement_rate": round(low_to_critical_count / len(rows), 4),
    }


def _fit_best_calibrated_model(
    model: Pipeline,
    x_train: pd.DataFrame,
    y_train: pd.Series,
    x_validation: pd.DataFrame,
    y_validation: pd.Series,
) -> tuple[Any, dict[str, Any]]:
    fitted_models: list[tuple[str, Any]] = []
    uncalibrated = clone(model)
    uncalibrated.fit(x_train, y_train)
    fitted_models.append(("uncalibrated", uncalibrated))

    for method in ["sigmoid", "isotonic"]:
        calibrated = CalibratedClassifierCV(
            estimator=clone(model),
            cv=3,
            method=method,
        )
        calibrated.fit(x_train, y_train)
        fitted_models.append((method, calibrated))

    calibration_scores: dict[str, dict[str, float]] = {}
    for method, fitted_model in fitted_models:
        probabilities = fitted_model.predict_proba(x_validation)[:, 1]
        calibration_scores[method] = {
            "brier_score": round(float(brier_score_loss(y_validation, probabilities)), 4),
            "log_loss": round(float(log_loss(y_validation, probabilities, labels=[0, 1])), 4),
        }

    selected_method, selected_model = sorted(
        fitted_models,
        key=lambda item: (
            calibration_scores[item[0]]["brier_score"],
            calibration_scores[item[0]]["log_loss"],
        ),
    )[0]

    return selected_model, {
        "selected_calibration_method": selected_method,
        "compared_methods": calibration_scores,
        "selection_rule": "lowest grouped-validation Brier score, then log loss",
    }


def train_runtime_model() -> dict[str, Any]:
    if not DATASET_PATH.exists():
        raise FileNotFoundError(
            f"Runtime training dataset is missing: {DATASET_PATH}. "
            "Place Date_final_dataset_balanced_float32.parquet under data/raw/ before retraining."
        )

    raw_frame = pd.read_parquet(DATASET_PATH)
    features, labels = build_runtime_training_frame(raw_frame)

    if len(features) > MAX_TRAINING_ROWS:
        sample = features.assign(is_fire=labels).sample(
            n=MAX_TRAINING_ROWS,
            random_state=RANDOM_STATE,
        )
        labels = sample.pop("is_fire").astype(int)
        features = sample.loc[:, list(RUNTIME_FEATURES)]

    x_random_train, x_random_test, y_random_train, y_random_test = train_test_split(
        features,
        labels,
        test_size=0.25,
        stratify=labels,
        random_state=RANDOM_STATE,
    )
    grouped_split = grouped_runtime_validation_split(
        features,
        labels,
        test_size=0.25,
        random_state=RANDOM_STATE,
    )
    x_train = grouped_split.x_train
    x_test = grouped_split.x_validation
    y_train = grouped_split.y_train
    y_test = grouped_split.y_validation

    candidate_evidence: dict[str, Any] = {}
    fitted_candidates: dict[str, Any] = {}
    candidate_models = _candidate_models()
    for name, model in candidate_models.items():
        random_model = clone(model)
        random_model.fit(x_random_train, y_random_train)
        random_metrics = _metrics_for(random_model, x_random_test, y_random_test)

        grouped_model = clone(model)
        grouped_model.fit(x_train, y_train)
        fitted_candidates[name] = grouped_model
        grouped_metrics = _metrics_for(grouped_model, x_test, y_test)
        candidate_evidence[name] = {
            **random_metrics,
            "serving_enabled": False,
            "calibration_selection": {
                "selected_calibration_method": "uncalibrated",
                "compared_methods": {},
                "selection_rule": "Calibration not run before initial grouped-validation ranking.",
            },
            "validation_metrics": random_metrics,
            "grouped_validation_metrics": grouped_metrics,
        }

    initial_candidate_ranking = sorted(
        candidate_evidence,
        key=lambda item: (
            candidate_evidence[item]["wildfire_recall"],
            candidate_evidence[item]["wildfire_f1"],
            candidate_evidence[item]["roc_auc"],
        ),
        reverse=True,
    )
    initial_grouped_candidate_ranking = sorted(
        candidate_evidence,
        key=lambda item: (
            candidate_evidence[item]["grouped_validation_metrics"]["wildfire_recall"],
            candidate_evidence[item]["grouped_validation_metrics"]["wildfire_f1"],
            candidate_evidence[item]["grouped_validation_metrics"]["roc_auc"],
        ),
        reverse=True,
    )
    calibration_candidates = [
        name for name in initial_grouped_candidate_ranking if name in CALIBRATION_ELIGIBLE_MODELS
    ][:CALIBRATION_TOP_K]
    for name in calibration_candidates:
        fitted_model, calibration_selection = _fit_best_calibrated_model(
            candidate_models[name],
            x_train,
            y_train,
            x_test,
            y_test,
        )
        fitted_candidates[name] = fitted_model
        grouped_metrics = _metrics_for(fitted_model, x_test, y_test)
        candidate_evidence[name] = {
            **candidate_evidence[name],
            "calibration_selection": calibration_selection,
            "grouped_validation_metrics": grouped_metrics,
        }

    grouped_candidate_ranking = sorted(
        candidate_evidence,
        key=lambda item: (
            candidate_evidence[item]["grouped_validation_metrics"]["wildfire_recall"],
            candidate_evidence[item]["grouped_validation_metrics"]["wildfire_f1"],
            candidate_evidence[item]["grouped_validation_metrics"]["roc_auc"],
        ),
        reverse=True,
    )
    candidate_ranking = sorted(
        candidate_evidence,
        key=lambda item: (
            candidate_evidence[item]["wildfire_recall"],
            candidate_evidence[item]["wildfire_f1"],
            candidate_evidence[item]["roc_auc"],
        ),
        reverse=True,
    )
    selected_algorithm = candidate_ranking[0]
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
    for name, model in fitted_candidates.items():
        candidate_evidence[name]["calibration_diagnostics"] = _calibration_diagnostics(
            model,
            x_test,
            y_test,
            score_thresholds,
        )
    disagreement = _candidate_disagreement(fitted_candidates, x_test, score_thresholds)
    model_thresholds = {
        name: {
            "low_max": score_thresholds["low_max"],
            "medium_max": score_thresholds["medium_max"],
            "high_max": score_thresholds["high_max"],
            "critical_min": score_thresholds["critical_min"],
            "selection_note": "Derived for the selected serving model from grouped validation score review.",
        }
        for name in fitted_candidates.keys()
    }
    for name in fitted_candidates.keys():
        candidate_evidence[name]["serving_enabled"] = True

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
            "stand-ins for the deployed same-window Weather API Source runtime feature schema; lag_2 through "
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
        "candidate_model_ranking": candidate_ranking,
        "grouped_candidate_model_ranking": grouped_candidate_ranking,
        "validation_metrics": selected_metrics["validation_metrics"],
        "grouped_validation_metrics": selected_metrics["grouped_validation_metrics"],
        "serving_models": list(fitted_candidates.keys()),
        "threshold_version": THRESHOLD_VERSION,
        "threshold_evidence_inputs": score_thresholds,
        "model_thresholds": model_thresholds,
        "runtime_validation_split": {
            "method": "group_shuffle_split_by_runtime_feature_hash",
            "hash_features": list(RUNTIME_FEATURES),
            "train_unique_feature_hashes": len(grouped_split.train_feature_hashes),
            "validation_unique_feature_hashes": len(grouped_split.validation_feature_hashes),
            "duplicate_hash_overlap": 0,
        },
        "candidate_disagreement": disagreement,
        "transfer_limitation": TRANSFER_LIMITATION,
        "accuracy_claim": "Prototype Relative Wildfire Risk; not official Turkiye operational accuracy.",
    }

    artifact = {"model": selected_model, "models": fitted_candidates, "metadata": metadata}
    ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    METRICS_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, ARTIFACT_PATH)
    METRICS_PATH.write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return metadata


if __name__ == "__main__":
    evidence = train_runtime_model()
    print(json.dumps({"model_version": evidence["model_version"], "selected_algorithm": evidence["selected_algorithm"]}))
