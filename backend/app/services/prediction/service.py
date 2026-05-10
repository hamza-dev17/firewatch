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

    def __init__(self, artifact: dict[str, Any]) -> None:
        self._artifact = artifact
        self._model = artifact.get("model")
        self._metadata = artifact.get("metadata")
        if self._model is None or not isinstance(self._metadata, dict):
            raise PredictionServiceError("model artifact is missing model or metadata")

        feature_schema = self._metadata.get("feature_schema")
        unit_schema = self._metadata.get("unit_schema")
        if not isinstance(feature_schema, list) or not isinstance(unit_schema, dict):
            raise PredictionServiceError("model artifact is missing runtime feature schema metadata")

        self.feature_schema = [str(feature_name) for feature_name in feature_schema]
        self.unit_schema = {str(name): str(unit) for name, unit in unit_schema.items()}

    @classmethod
    def from_artifact_path(cls, path: Path) -> "PredictionService":
        if not path.exists():
            raise PredictionServiceError(f"model artifact does not exist: {path}")

        artifact = joblib.load(path)
        if not isinstance(artifact, dict):
            raise PredictionServiceError("model artifact has unsupported format")
        return cls(artifact)

    @property
    def metadata(self) -> dict[str, Any]:
        return dict(self._metadata)

    def predict(
        self,
        feature_values: dict[str, float],
        feature_units: dict[str, str],
    ) -> PredictionResult:
        validate_runtime_feature_vector(feature_values=feature_values, feature_units=feature_units)

        ordered_values = {feature_name: feature_values[feature_name] for feature_name in self.feature_schema}
        frame = pd.DataFrame([ordered_values], columns=self.feature_schema)

        if hasattr(self._model, "predict_proba"):
            probabilities = self._model.predict_proba(frame)[0]
            classes = list(getattr(self._model, "classes_", []))
            if 1 in classes:
                wildfire_index = classes.index(1)
            else:
                wildfire_index = len(probabilities) - 1

            risk_score = float(probabilities[wildfire_index])
            model_confidence = float(max(probabilities)) if len(probabilities) else None
        elif hasattr(self._model, "predict"):
            predicted = self._model.predict(frame)[0]
            risk_score = float(predicted)
            model_confidence = None
        else:
            raise PredictionServiceError("model artifact does not expose predict or predict_proba")

        return PredictionResult(
            risk_score=risk_score,
            model_confidence=model_confidence,
            model_version=str(self._metadata["model_version"]),
            selected_algorithm=str(self._metadata["selected_algorithm"]),
            feature_schema=list(self.feature_schema),
        )
