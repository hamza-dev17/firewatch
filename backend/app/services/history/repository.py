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
    archived_at: str | None = None

    def as_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "assessment_timestamp": self.assessment_timestamp,
            "source_state": self.source_state,
            "location": self.location,
            "requested_forecast_windows": self.requested_forecast_windows,
            "data_source_labels": self.data_source_labels,
            "forecast_assessments": self.forecast_assessments,
            "archived_at": self.archived_at,
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
                        forecast_assessments_json TEXT NOT NULL,
                        archived_at TEXT
                    )
                    """
                )
                columns = {
                    row[1]
                    for row in connection.execute("PRAGMA table_info(prediction_history_records)").fetchall()
                }
                if "archived_at" not in columns:
                    connection.execute("ALTER TABLE prediction_history_records ADD COLUMN archived_at TEXT")
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
        assessment_timestamp: str | None = None,
    ) -> str:
        record_id = str(uuid4())
        stored_timestamp = assessment_timestamp or datetime.now(tz=UTC).isoformat().replace("+00:00", "Z")

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
                        stored_timestamp,
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

    def list_records(
        self,
        *,
        region: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        risk_level: str | None = None,
        show_archived: bool = False,
    ) -> list[dict[str, object]]:
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
                        forecast_assessments_json,
                        archived_at
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
                archived_at,
            ) = row
            record = PredictionHistoryRecord(
                id=str(record_id),
                assessment_timestamp=str(assessment_timestamp),
                source_state=str(source_state),
                location=_safe_mapping(location_json),
                requested_forecast_windows=_safe_string_list(requested_windows_json),
                data_source_labels=_safe_mapping(data_source_labels_json),
                forecast_assessments=_safe_mapping_list(forecast_assessments_json),
                archived_at=str(archived_at) if archived_at else None,
            )
            record_dict = record.as_dict()
            if record.archived_at and not show_archived:
                continue
            if _matches_filters(
                record_dict,
                region=region,
                start_date=start_date,
                end_date=end_date,
                risk_level=risk_level,
            ):
                records.append(record_dict)

        return records

    def archive_record(self, record_id: str) -> str:
        archived_at = datetime.now(tz=UTC).isoformat().replace("+00:00", "Z")

        try:
            with self._connect() as connection:
                cursor = connection.execute(
                    """
                    UPDATE prediction_history_records
                    SET archived_at = COALESCE(archived_at, ?)
                    WHERE id = ?
                    """,
                    (archived_at, record_id),
                )
                connection.commit()
        except sqlite3.Error as exc:
            raise HistoryRepositoryError("Prediction history record cannot be archived.") from exc

        if cursor.rowcount == 0:
            raise HistoryRepositoryError("Prediction history record was not found.")

        return record_id


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


def _matches_filters(
    record: dict[str, object],
    *,
    region: str | None,
    start_date: str | None,
    end_date: str | None,
    risk_level: str | None,
) -> bool:
    assessment_date = str(record.get("assessment_timestamp", ""))[:10]
    if start_date and assessment_date < start_date:
        return False
    if end_date and assessment_date > end_date:
        return False

    if region and not _location_matches_region(record.get("location"), region):
        return False

    if risk_level and not _forecast_assessments_include_risk_level(
        record.get("forecast_assessments"),
        risk_level,
    ):
        return False

    return True


def _location_matches_region(location: object, region: str) -> bool:
    if not isinstance(location, dict):
        return False

    needle = region.strip().lower()
    if not needle:
        return True

    values = [value for value in location.values() if isinstance(value, str)]
    return any(needle in value.lower() for value in values)


def _forecast_assessments_include_risk_level(
    forecast_assessments: object,
    risk_level: str,
) -> bool:
    if not isinstance(forecast_assessments, list):
        return False

    expected = risk_level.strip().lower()
    if not expected:
        return True

    return any(
        isinstance(assessment, dict)
        and str(assessment.get("risk_level", "")).lower() == expected
        for assessment in forecast_assessments
    )


def build_prediction_history_repository() -> SqlitePredictionHistoryRepository:
    settings = get_settings()
    return SqlitePredictionHistoryRepository(database_url=settings.database_url)
