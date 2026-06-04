"""Application configuration and status helpers for FIREWATCH DSS."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

import joblib
from dotenv import load_dotenv
from app.services.features.runtime_contract import build_runtime_feature_contract_payload

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = Path(__file__).resolve().parents[2]
SUPPORTED_MODEL_ALGORITHMS = [
    "logistic_regression",
    "random_forest",
    "extra_trees",
    "gradient_boosting",
    "soft_voting_hybrid",
    "stacking_hybrid",
    "xgboost",
]

# Load environment configuration in a predictable order.
load_dotenv(REPO_ROOT / ".env", override=False)
load_dotenv(BACKEND_ROOT / ".env", override=False)


@dataclass(frozen=True)
class AppSettings:
    mapbox_access_token: str
    openweather_api_key: str
    groq_api_key: str
    model_artifact_path: Path
    database_url: str


def _safe_state_from_value(value: str) -> str:
    if value:
        return "configured"
    return "missing"


def _model_artifact_state(path: Path) -> str:
    if not path.as_posix():
        return "missing"
    if path.exists():
        return "configured"
    return "unavailable"


def _model_evidence_payload() -> dict[str, object]:
    evidence_path = REPO_ROOT / "ml" / "metrics" / "runtime_model_evidence.json"
    if not evidence_path.exists():
        return {
            "state": "unavailable",
            "message": "Model evidence file has not been generated.",
        }

    try:
        evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {
            "state": "unavailable",
            "message": "Model evidence file could not be read.",
        }

    if not isinstance(evidence, dict):
        return {
            "state": "unavailable",
            "message": "Model evidence file has unsupported format.",
        }

    evidence["state"] = "configured"
    return evidence


def _model_selection_payload(path: Path) -> dict[str, object]:
    if not path.exists():
        return {
            "state": "unavailable",
            "supported_algorithms": list(SUPPORTED_MODEL_ALGORITHMS),
            "available_algorithms": [],
            "message": "Model artifact is unavailable.",
        }

    try:
        artifact = joblib.load(path)
    except Exception:
        return {
            "state": "unavailable",
            "supported_algorithms": list(SUPPORTED_MODEL_ALGORITHMS),
            "available_algorithms": [],
            "message": "Model artifact could not be read.",
        }

    if not isinstance(artifact, dict):
        return {
            "state": "unavailable",
            "supported_algorithms": list(SUPPORTED_MODEL_ALGORITHMS),
            "available_algorithms": [],
            "message": "Model artifact has unsupported format.",
        }

    metadata = artifact.get("metadata")
    selected_algorithm = ""
    serving_algorithms: list[str] = []
    if isinstance(metadata, dict):
        selected_algorithm = str(metadata.get("selected_algorithm", "")).strip()
        raw_serving_models = metadata.get("serving_models")
        if isinstance(raw_serving_models, list):
            serving_algorithms = sorted(str(name).strip() for name in raw_serving_models if str(name).strip())
        if not serving_algorithms:
            candidate_models = metadata.get("candidate_models")
            if isinstance(candidate_models, dict):
                serving_algorithms = sorted(
                    str(name).strip()
                    for name, evidence in candidate_models.items()
                    if isinstance(evidence, dict)
                    and evidence.get("serving_enabled") is True
                    and str(name).strip()
                )

    models = artifact.get("models")
    if isinstance(models, dict) and models:
        available_algorithms = sorted(str(name) for name in models if str(name).strip())
    else:
        available_algorithms = [selected_algorithm] if selected_algorithm else []
    if not serving_algorithms and selected_algorithm:
        serving_algorithms = [selected_algorithm]

    return {
        "state": "configured",
        "supported_algorithms": list(SUPPORTED_MODEL_ALGORITHMS),
        "available_algorithms": available_algorithms,
        "serving_algorithms": serving_algorithms,
        "message": (
            None
            if serving_algorithms
            else "No model algorithm is enabled for live assessment."
        ),
    }


def _persistence_state(database_url: str) -> tuple[str, str]:
    if not database_url:
        return "missing", "unknown"

    dialect = database_url.split(":", 1)[0] if ":" in database_url else "unknown"
    if dialect != "sqlite":
        return "configured", dialect

    raw_path = database_url.removeprefix("sqlite:///")
    sqlite_path = Path(raw_path)
    if not sqlite_path.is_absolute():
        sqlite_path = REPO_ROOT / sqlite_path

    if sqlite_path.parent.exists() and os.access(sqlite_path.parent, os.W_OK):
        return "configured", "sqlite"
    return "unavailable", "sqlite"


def _repo_relative_path(path_value: str) -> Path:
    path = Path(path_value)
    if path.is_absolute():
        return path
    return REPO_ROOT / path


def get_settings() -> AppSettings:
    model_artifact_path = _repo_relative_path(
        os.getenv("MODEL_ARTIFACT_PATH", str(REPO_ROOT / "ml" / "artifacts" / "model.joblib"))
    )

    return AppSettings(
        mapbox_access_token=os.getenv("MAPBOX_ACCESS_TOKEN", ""),
        openweather_api_key=os.getenv("OPENWEATHER_API_KEY", ""),
        groq_api_key=os.getenv("GROQ_API_KEY", ""),
        model_artifact_path=model_artifact_path,
        database_url=os.getenv("DATABASE_URL", "sqlite:///storage/firewatch.sqlite3"),
    )


def build_status_payload() -> dict[str, object]:
    settings = get_settings()
    persistence_state, persistence_dialect = _persistence_state(settings.database_url)

    return {
        "service": "FIREWATCH DSS Backend",
        "integrations": {
            "mapbox": _safe_state_from_value(settings.mapbox_access_token),
            "openweather": _safe_state_from_value(settings.openweather_api_key),
            "groq": _safe_state_from_value(settings.groq_api_key),
        },
        "runtime": {
            "model_artifact": {
                "state": _model_artifact_state(settings.model_artifact_path),
                "path": str(settings.model_artifact_path),
            },
            "model_evidence": _model_evidence_payload(),
            "model_selection": _model_selection_payload(settings.model_artifact_path),
            "persistence": {
                "state": persistence_state,
                "dialect": persistence_dialect,
            },
            "feature_contract": build_runtime_feature_contract_payload(),
        },
    }
