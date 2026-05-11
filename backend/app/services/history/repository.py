"""Prediction history repository boundary with SQLite implementation for MVP."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from app.core.config import REPO_ROOT, get_settings


class HistoryRepositoryError(RuntimeError):
    """Raised when prediction history persistence fails."""


@dataclass(frozen=True)
class PredictionHistoryRecord:
    id: str
    assessment_timestamp: str
    source_state: str
    location: dict[str, object]
    requested_forecast_windows: list[str]
    data_source_labels: dict[str, object]
    forecast_assessments: list[dict[str, object]]

    def as_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "assessment_timestamp": self.assessment_timestamp,
            "source_state": self.source_state,
            "location": self.location,
            "requested_forecast_windows": self.requested_forecast_windows,
            "data_source_labels": self.data_source_labels,
            "forecast_assessments": self.forecast_assessments,
        }


def _sqlite_path_from_database_url(database_url: str) -> Path:
    if not database_url.startswith("sqlite:///"):
        raise HistoryRepositoryError("Prediction history currently supports sqlite URLs only.")

    raw_path = database_url.removeprefix("sqlite:///")
    sqlite_path = Path(raw_path)
    if not sqlite_path.is_absolute():
        sqlite_path = REPO_ROOT / sqlite_path
    return sqlite_path


class SqlitePredictionHistoryRepository:
    """Stores grouped prediction history records behind a repository boundary."""

    def __init__(self, database_url: str) -> None:
        self._database_path = _sqlite_path_from_database_url(database_url)
        self._database_path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_schema()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self._database_path)

    def _ensure_schema(self) -> None:
        try:
            with self._connect() as connection:
                connection.execute(
                    """
                    CREATE TABLE IF NOT EXISTS prediction_history_records (
                        id TEXT PRIMARY KEY,
                        assessment_timestamp TEXT NOT NULL,
                        source_state TEXT NOT NULL,
                        location_json TEXT NOT NULL,
                        requested_forecast_windows_json TEXT NOT NULL,
                        data_source_labels_json TEXT NOT NULL,
                        forecast_assessments_json TEXT NOT NULL
                    )
                    """
                )
                connection.commit()
        except sqlite3.Error as exc:
            raise HistoryRepositoryError("Prediction history storage schema is unavailable.") from exc

    def save_record(
        self,
        *,
        source_state: str,
        location: dict[str, object],
        requested_forecast_windows: list[str],
        data_source_labels: dict[str, object],
        forecast_assessments: list[dict[str, object]],
    ) -> str:
        record_id = str(uuid4())
        assessment_timestamp = datetime.now(tz=UTC).isoformat().replace("+00:00", "Z")

        try:
            with self._connect() as connection:
                connection.execute(
                    """
                    INSERT INTO prediction_history_records (
                        id,
                        assessment_timestamp,
                        source_state,
                        location_json,
                        requested_forecast_windows_json,
                        data_source_labels_json,
                        forecast_assessments_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        record_id,
                        assessment_timestamp,
                        source_state,
                        json.dumps(location, ensure_ascii=True),
                        json.dumps(requested_forecast_windows, ensure_ascii=True),
                        json.dumps(data_source_labels, ensure_ascii=True),
                        json.dumps(forecast_assessments, ensure_ascii=True),
                    ),
                )
                connection.commit()
        except sqlite3.Error as exc:
            raise HistoryRepositoryError("Prediction history persistence failed.") from exc

        return record_id

    def list_records(self) -> list[dict[str, object]]:
        try:
            with self._connect() as connection:
                rows = connection.execute(
                    """
                    SELECT
                        id,
                        assessment_timestamp,
                        source_state,
                        location_json,
                        requested_forecast_windows_json,
                        data_source_labels_json,
                        forecast_assessments_json
                    FROM prediction_history_records
                    ORDER BY assessment_timestamp DESC
                    """
                ).fetchall()
        except sqlite3.Error as exc:
            raise HistoryRepositoryError("Prediction history records cannot be read.") from exc

        records: list[dict[str, object]] = []
        for row in rows:
            (
                record_id,
                assessment_timestamp,
                source_state,
                location_json,
                requested_windows_json,
                data_source_labels_json,
                forecast_assessments_json,
            ) = row
            record = PredictionHistoryRecord(
                id=str(record_id),
                assessment_timestamp=str(assessment_timestamp),
                source_state=str(source_state),
                location=_safe_mapping(location_json),
                requested_forecast_windows=_safe_string_list(requested_windows_json),
                data_source_labels=_safe_mapping(data_source_labels_json),
                forecast_assessments=_safe_mapping_list(forecast_assessments_json),
            )
            records.append(record.as_dict())

        return records


def _safe_mapping(value: object) -> dict[str, object]:
    if not isinstance(value, str):
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {}
    if isinstance(parsed, dict):
        return parsed
    return {}


def _safe_string_list(value: object) -> list[str]:
    if not isinstance(value, str):
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [item for item in parsed if isinstance(item, str)]


def _safe_mapping_list(value: object) -> list[dict[str, object]]:
    if not isinstance(value, str):
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [item for item in parsed if isinstance(item, dict)]


def build_prediction_history_repository() -> SqlitePredictionHistoryRepository:
    settings = get_settings()
    return SqlitePredictionHistoryRepository(database_url=settings.database_url)
