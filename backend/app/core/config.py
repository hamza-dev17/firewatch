"""Application configuration and status helpers for FIREWATCH DSS."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = Path(__file__).resolve().parents[2]

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


def get_settings() -> AppSettings:
    model_artifact_path = Path(
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
            "persistence": {
                "state": persistence_state,
                "dialect": persistence_dialect,
            },
        },
    }
