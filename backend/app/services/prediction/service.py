"""Runtime prediction service for FIREWATCH DSS model artifacts."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from app.services.features.runtime_contract import validate_runtime_feature_vector


class PredictionServiceError(RuntimeError):
    """Raised when the selected model artifact cannot serve a prediction."""


@dataclass(frozen=True)
class PredictionResult:
    risk_score: float
    model_confidence: float | None
    model_version: str
    selected_algorithm: str
    feature_schema: list[str]


class PredictionService:
    """Small runtime interface around the selected model artifact."""

    def __init__(self, artifact: dict[str, Any], algorithm: str | None = None) -> None:
        self._artifact = artifact
        self._metadata = artifact.get("metadata")
        default_model = artifact.get("model")
        if default_model is None or not isinstance(self._metadata, dict):
            raise PredictionServiceError("model artifact is missing model or metadata")

        selected_algorithm = str(self._metadata.get("selected_algorithm", "")).strip()
        raw_models = artifact.get("models")
        if isinstance(raw_models, dict) and raw_models:
            self._models = {str(name): model for name, model in raw_models.items()}
        else:
            self._models = {selected_algorithm: default_model}

        self._selected_algorithm = algorithm or selected_algorithm
        if self._selected_algorithm not in self._models:
            available = ", ".join(sorted(name for name in self._models if name))
            raise PredictionServiceError(
                f"model artifact does not include algorithm '{self._selected_algorithm}'. "
                f"Available algorithms: {available or 'none'}."
            )
        serving_algorithms = self._serving_algorithms(selected_algorithm)
        if self._selected_algorithm not in serving_algorithms:
            serving = ", ".join(sorted(serving_algorithms))
            raise PredictionServiceError(
                f"model algorithm '{self._selected_algorithm}' is not enabled for live assessment. "
                f"Serving algorithms: {serving or selected_algorithm or 'none'}."
            )

        self._model = self._models[self._selected_algorithm]
        feature_schema = self._metadata.get("feature_schema")
        unit_schema = self._metadata.get("unit_schema")
        if not isinstance(feature_schema, list) or not isinstance(unit_schema, dict):
            raise PredictionServiceError("model artifact is missing runtime feature schema metadata")

        self.feature_schema = [str(feature_name) for feature_name in feature_schema]
        self.unit_schema = {str(name): str(unit) for name, unit in unit_schema.items()}

    @classmethod
    def from_artifact_path(cls, path: Path, algorithm: str | None = None) -> "PredictionService":
        if not path.exists():
            raise PredictionServiceError(f"model artifact does not exist: {path}")

        artifact = joblib.load(path)
        if not isinstance(artifact, dict):
            raise PredictionServiceError("model artifact has unsupported format")
        return cls(artifact, algorithm=algorithm)

    @property
    def metadata(self) -> dict[str, Any]:
        return dict(self._metadata)

    @property
    def selected_algorithm(self) -> str:
        return self._selected_algorithm

    def _serving_algorithms(self, selected_algorithm: str) -> set[str]:
        raw_serving_models = self._metadata.get("serving_models")
        if isinstance(raw_serving_models, list):
            serving_models = {str(name).strip() for name in raw_serving_models if str(name).strip()}
            if serving_models:
                return serving_models

        candidate_models = self._metadata.get("candidate_models")
        if isinstance(candidate_models, dict):
            serving_models = {
                str(name).strip()
                for name, evidence in candidate_models.items()
                if isinstance(evidence, dict) and evidence.get("serving_enabled") is True and str(name).strip()
            }
            if serving_models:
                return serving_models

        return {selected_algorithm} if selected_algorithm else set()

    def predict(
        self,
        feature_values: dict[str, float],
        feature_units: dict[str, str],
    ) -> PredictionResult:
        validate_runtime_feature_vector(feature_values=feature_values, feature_units=feature_units)

        ordered_values = {feature_name: feature_values[feature_name] for feature_name in self.feature_schema}
        frame = pd.DataFrame([ordered_values], columns=self.feature_schema)

        risk_score, model_confidence = self._predict_risk_score_and_confidence(frame)

        return PredictionResult(
            risk_score=risk_score,
            model_confidence=model_confidence,
            model_version=str(self._metadata["model_version"]),
            selected_algorithm=self._selected_algorithm,
            feature_schema=list(self.feature_schema),
        )

    def explain(
        self,
        feature_values: dict[str, float],
        feature_units: dict[str, str],
        max_features: int = 3,
    ) -> dict[str, object]:
        validate_runtime_feature_vector(feature_values=feature_values, feature_units=feature_units)
        if max_features < 1:
            max_features = 1

        ordered_values = {feature_name: feature_values[feature_name] for feature_name in self.feature_schema}
        baseline_values = self._baseline_feature_values(ordered_values)
        base_frame = pd.DataFrame([ordered_values], columns=self.feature_schema)
        base_risk_score, _ = self._predict_risk_score_and_confidence(base_frame)

        impacts: list[dict[str, object]] = []
        for feature_name in self.feature_schema:
            perturbed_values = dict(ordered_values)
            perturbed_values[feature_name] = baseline_values[feature_name]
            perturbed_frame = pd.DataFrame([perturbed_values], columns=self.feature_schema)
            perturbed_risk_score, _ = self._predict_risk_score_and_confidence(perturbed_frame)
            contribution = base_risk_score - perturbed_risk_score

            direction = "neutral"
            if contribution > 0:
                direction = "increases_risk"
            elif contribution < 0:
                direction = "decreases_risk"

            impacts.append(
                {
                    "feature_name": feature_name,
                    "feature_value": float(ordered_values[feature_name]),
                    "baseline_value": float(baseline_values[feature_name]),
                    "contribution_to_risk_score": round(float(contribution), 6),
                    "direction": direction,
                }
            )

        top_impacts = sorted(
            impacts,
            key=lambda item: abs(float(item["contribution_to_risk_score"])),
            reverse=True,
        )[:max_features]

        return {
            "label": "Model behavior explanation (not causal proof).",
            "method": "runtime_feature_perturbation_v1",
            "uses_runtime_features_only": True,
            "feature_scope": list(self.feature_schema),
            "top_feature_impacts": top_impacts,
            "limitations": self._explanation_limitations(),
        }

    def _predict_risk_score_and_confidence(self, frame: pd.DataFrame) -> tuple[float, float | None]:
        if hasattr(self._model, "predict_proba"):
            probabilities = self._model.predict_proba(frame)[0]
            classes = list(getattr(self._model, "classes_", []))
            if 1 in classes:
                wildfire_index = classes.index(1)
            else:
                wildfire_index = len(probabilities) - 1

            risk_score = float(probabilities[wildfire_index])
            model_confidence = float(max(probabilities)) if len(probabilities) else None
            return risk_score, model_confidence

        if hasattr(self._model, "predict"):
            predicted = self._model.predict(frame)[0]
            return float(predicted), None

        raise PredictionServiceError("model artifact does not expose predict or predict_proba")

    def _baseline_feature_values(self, ordered_values: dict[str, float]) -> dict[str, float]:
        baseline_values = dict(ordered_values)
        named_steps = getattr(self._model, "named_steps", None)
        imputer = named_steps.get("imputer") if isinstance(named_steps, dict) else None
        statistics = getattr(imputer, "statistics_", None)

        if statistics is None:
            return baseline_values
        if len(statistics) != len(self.feature_schema):
            return baseline_values

        for index, feature_name in enumerate(self.feature_schema):
            try:
                baseline_values[feature_name] = float(statistics[index])
            except (TypeError, ValueError):
                baseline_values[feature_name] = float(ordered_values[feature_name])
        return baseline_values

    def _explanation_limitations(self) -> list[str]:
        dataset_role = str(self._metadata.get("dataset_role", "")).strip()
        transfer_limitation = str(self._metadata.get("transfer_limitation", "")).strip()

        limitations = [
            "Explanation describes model behavior on this feature vector, not proven real-world wildfire causality.",
            "Approximate perturbation impacts may differ from exact SHAP values.",
        ]
        if dataset_role:
            limitations.append(f"Model was trained as a {dataset_role}; transfer uncertainty remains.")
        if transfer_limitation:
            limitations.append(transfer_limitation)
        return limitations
