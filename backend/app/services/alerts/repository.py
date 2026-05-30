"""Risk alert repository boundary with SQLite implementation for MVP."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from app.core.config import REPO_ROOT, get_settings
from app.services.history.repository import HistoryRepositoryError


class RiskAlertRepositoryError(RuntimeError):
    """Raised when risk alert persistence fails."""


@dataclass(frozen=True)
class RiskAlertRecord:
    id: str
    created_at: str
    expires_at: str
    status: str
    recommendation_rule_version: str
    location_name: str
    latitude: float
    longitude: float
    forecast_window: str
    risk_level: str
    risk_score: float
    recommended_action: str
    alert_text: str

    def as_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "status": self.status,
            "recommendation_rule_version": self.recommendation_rule_version,
            "location_name": self.location_name,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "forecast_window": self.forecast_window,
            "risk_level": self.risk_level,
            "risk_score": self.risk_score,
            "recommended_action": self.recommended_action,
            "alert_text": self.alert_text,
        }


def _sqlite_path_from_database_url(database_url: str) -> Path:
    if not database_url.startswith("sqlite:///"):
        raise HistoryRepositoryError("Risk alerts currently support sqlite URLs only.")

    raw_path = database_url.removeprefix("sqlite:///")
    sqlite_path = Path(raw_path)
    if not sqlite_path.is_absolute():
        sqlite_path = REPO_ROOT / sqlite_path
    return sqlite_path


def _utc_iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _parse_iso_utc(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


class SqliteRiskAlertRepository:
    """Stores active risk alerts behind a repository boundary."""

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
                    CREATE TABLE IF NOT EXISTS risk_alerts (
                        id TEXT PRIMARY KEY,
                        created_at TEXT NOT NULL,
                        expires_at TEXT NOT NULL,
                        status TEXT NOT NULL,
                        recommendation_rule_version TEXT NOT NULL,
                        location_name TEXT NOT NULL,
                        latitude REAL NOT NULL,
                        longitude REAL NOT NULL,
                        forecast_window TEXT NOT NULL,
                        risk_level TEXT NOT NULL,
                        risk_score REAL NOT NULL,
                        recommended_action TEXT NOT NULL,
                        alert_text TEXT NOT NULL
                    )
                    """
                )
                connection.commit()
        except sqlite3.Error as exc:
            raise RiskAlertRepositoryError("Risk alert storage schema is unavailable.") from exc

    def create_alert(
        self,
        *,
        location: dict[str, object],
        forecast_window: str,
        risk_level: str,
        risk_score: float,
        recommended_action: str,
        recommendation_rule_version: str,
        risk_alert_expiry_hours: int,
    ) -> str:
        created_at = datetime.now(tz=UTC)
        expires_at = created_at + timedelta(hours=risk_alert_expiry_hours)
        alert_id = str(uuid4())
        location_name = str(location.get("name") or "Selected location")
        latitude = float(location["latitude"])
        longitude = float(location["longitude"])
        alert_text = (
            f"System-generated risk alert: {risk_level.upper()} relative wildfire risk for "
            f"{location_name} ({forecast_window}). Recommended action: {recommended_action}."
        )

        try:
            with self._connect() as connection:
                connection.execute(
                    """
                    INSERT INTO risk_alerts (
                        id,
                        created_at,
                        expires_at,
                        status,
                        recommendation_rule_version,
                        location_name,
                        latitude,
                        longitude,
                        forecast_window,
                        risk_level,
                        risk_score,
                        recommended_action,
                        alert_text
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        alert_id,
                        _utc_iso(created_at),
                        _utc_iso(expires_at),
                        "active",
                        recommendation_rule_version,
                        location_name,
                        latitude,
                        longitude,
                        forecast_window,
                        risk_level,
                        risk_score,
                        recommended_action,
                        alert_text,
                    ),
                )
                connection.commit()
        except sqlite3.Error as exc:
            raise RiskAlertRepositoryError("Risk alert persistence failed.") from exc

        return alert_id

    def list_active_alerts(self) -> list[dict[str, object]]:
        try:
            with self._connect() as connection:
                rows = connection.execute(
                    """
                    SELECT
                        id,
                        created_at,
                        expires_at,
                        status,
                        recommendation_rule_version,
                        location_name,
                        latitude,
                        longitude,
                        forecast_window,
                        risk_level,
                        risk_score,
                        recommended_action,
                        alert_text
                    FROM risk_alerts
                    WHERE status = 'active'
                    ORDER BY created_at DESC
                    """
                ).fetchall()
        except sqlite3.Error as exc:
            raise RiskAlertRepositoryError("Risk alerts cannot be read.") from exc

        now = datetime.now(tz=UTC)
        active: list[dict[str, object]] = []
        for row in rows:
            record = RiskAlertRecord(
                id=str(row[0]),
                created_at=str(row[1]),
                expires_at=str(row[2]),
                status=str(row[3]),
                recommendation_rule_version=str(row[4]),
                location_name=str(row[5]),
                latitude=float(row[6]),
                longitude=float(row[7]),
                forecast_window=str(row[8]),
                risk_level=str(row[9]),
                risk_score=float(row[10]),
                recommended_action=str(row[11]),
                alert_text=str(row[12]),
            )
            if _parse_iso_utc(record.expires_at) <= now:
                continue
            active.append(record.as_dict())
        return active


def build_risk_alert_repository() -> SqliteRiskAlertRepository:
    settings = get_settings()
    return SqliteRiskAlertRepository(database_url=settings.database_url)
