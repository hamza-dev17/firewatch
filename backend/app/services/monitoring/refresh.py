"""Refresh live assessments for backend-owned watch locations."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.services.assessment.api import build_assessment_response
from app.services.history.repository import HistoryRepositoryError, build_prediction_history_repository
from app.services.monitoring.watchlist import get_watch_locations


DEFAULT_WATCH_REFRESH_FRESHNESS_MINUTES = 30
WATCH_REFRESH_FORECAST_WINDOWS = ["now"]


def _parse_timestamp(value: object) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None


def _latest_watch_assessment_times() -> dict[str, datetime]:
    try:
        records = build_prediction_history_repository().list_records()
    except HistoryRepositoryError:
        return {}

    latest: dict[str, datetime] = {}
    for record in records:
        location = record.get("location")
        if not isinstance(location, dict):
            continue
        region = str(location.get("name") or "").strip().casefold()
        timestamp = _parse_timestamp(record.get("assessment_timestamp"))
        if not region or timestamp is None or region in latest:
            continue
        latest[region] = timestamp
    return latest


def refresh_watchlist_assessments(
    *,
    freshness_minutes: int = DEFAULT_WATCH_REFRESH_FRESHNESS_MINUTES,
    now: datetime | None = None,
) -> dict[str, object]:
    checked_at = now or datetime.now(tz=UTC)
    fresh_after = checked_at - timedelta(minutes=max(freshness_minutes, 0))
    latest_assessment_times = _latest_watch_assessment_times()

    refreshed: list[dict[str, object]] = []
    skipped: list[dict[str, object]] = []
    failed: list[dict[str, object]] = []

    for location in get_watch_locations():
        region = str(location["name"])
        latest_assessment_time = latest_assessment_times.get(region.casefold())
        if latest_assessment_time is not None and latest_assessment_time >= fresh_after:
            skipped.append(
                {
                    "region": region,
                    "reason": "fresh",
                    "assessed_at": latest_assessment_time.isoformat().replace("+00:00", "Z"),
                }
            )
            continue

        assessment_payload = build_assessment_response(
            location={
                "name": region,
                "latitude": location["latitude"],
                "longitude": location["longitude"],
                "source": "system-watchlist",
            },
            forecast_windows=WATCH_REFRESH_FORECAST_WINDOWS,
        )

        if assessment_payload.get("source_state") == "live":
            refreshed.append(
                {
                    "region": region,
                    "prediction_history_record_id": assessment_payload.get("prediction_history_record_id"),
                }
            )
            continue

        failed.append(
            {
                "region": region,
                "message": str(assessment_payload.get("message") or "Assessment unavailable."),
            }
        )

    return {
        "source_state": "live" if not failed else "degraded",
        "checked_at": checked_at.isoformat().replace("+00:00", "Z"),
        "freshness_minutes": freshness_minutes,
        "refreshed": refreshed,
        "skipped": skipped,
        "failed": failed,
        "message": None if not failed else "Some watchlist assessments could not be refreshed.",
    }
