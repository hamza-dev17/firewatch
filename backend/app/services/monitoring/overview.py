"""Live regional monitoring overview for backend-owned watch locations."""

from __future__ import annotations

from app.services.history.repository import (
    HistoryRepositoryError,
    build_prediction_history_repository,
)
from app.services.monitoring.watchlist import (
    WATCHLIST_SOURCE_LABEL,
    get_watch_locations,
    get_watch_region_names,
)


_RISK_PRIORITY = {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
    "pending": 4,
    "unknown": 5,
}


def _now_assessment(record: dict[str, object]) -> dict[str, object] | None:
    assessments = record.get("forecast_assessments")
    if not isinstance(assessments, list):
        return None
    for assessment in assessments:
        if isinstance(assessment, dict) and assessment.get("forecast_window") == "now":
            return assessment
    return None


def _sort_summary(summary: dict[str, object]) -> tuple[int, float, str]:
    risk_level = str(summary.get("risk_level") or "unknown").lower()
    risk_score = float(summary.get("risk_score") or 0.0)
    assessed_at = str(summary.get("assessed_at") or "")
    return (_RISK_PRIORITY.get(risk_level, _RISK_PRIORITY["unknown"]), -risk_score, assessed_at)


def _priority_regions(summaries: list[dict[str, object]]) -> list[dict[str, object]]:
    priority_regions: list[dict[str, object]] = []
    for index, summary in enumerate(summaries):
        priority_region = {
            "region": str(summary["region"]),
            "priority_rank": str(summary.get("priority_rank") or f"P{index + 1}"),
            "risk_level": str(summary.get("risk_level") or "unknown"),
            "data_source_label": summary["data_source_label"],
        }
        if isinstance(summary.get("risk_score"), int | float):
            priority_region["risk_score"] = float(summary["risk_score"])
        priority_regions.append(priority_region)
    return priority_regions


def build_monitoring_overview_payload() -> dict[str, object]:
    monitoring_locations = get_watch_locations()
    try:
        records = build_prediction_history_repository().list_records()
    except HistoryRepositoryError as exc:
        return {
            "source_state": "degraded",
            "monitoring_locations": monitoring_locations,
            "predicted_risk_hotspots": [],
            "regional_summaries": [],
            "top_priority_regions": [],
            "data_source_labels": {
                "overview": "unavailable",
                "monitoring_locations": WATCHLIST_SOURCE_LABEL,
            },
            "message": str(exc),
        }

    summaries_by_region: dict[str, dict[str, object]] = {}
    seen_regions: set[str] = set()
    watch_regions = get_watch_region_names()
    for record in records:
        location = record.get("location")
        assessment = _now_assessment(record)
        if not isinstance(location, dict) or assessment is None:
            continue
        region = str(location.get("name") or "").strip()
        region_key = region.casefold()
        if not region or region_key not in watch_regions or region_key in seen_regions:
            continue
        seen_regions.add(region_key)
        summaries_by_region[region_key] = {
            "region": region,
            "risk_level": str(assessment.get("risk_level") or "unknown"),
            "risk_score": float(assessment.get("risk_score") or 0.0),
            "priority_rank": str(assessment.get("priority_rank") or ""),
            "assessed_at": str(record.get("assessment_timestamp") or ""),
            "data_source_label": "system-watchlist-history",
        }

    for location in monitoring_locations:
        region = str(location["name"])
        region_key = region.casefold()
        if region_key in summaries_by_region:
            continue
        summaries_by_region[region_key] = {
            "region": region,
            "risk_level": "pending",
            "priority_rank": "PENDING",
            "watch_reason": str(location.get("watch_reason") or ""),
            "data_source_label": WATCHLIST_SOURCE_LABEL,
        }

    summaries = list(summaries_by_region.values())
    summaries.sort(key=_sort_summary)

    return {
        "source_state": "live",
        "monitoring_locations": monitoring_locations,
        "predicted_risk_hotspots": [],
        "regional_summaries": summaries,
        "top_priority_regions": _priority_regions(summaries),
        "data_source_labels": {
            "overview": "system-watchlist-history",
            "monitoring_locations": WATCHLIST_SOURCE_LABEL,
            "regional_summary": "system-watchlist-history",
            "top_priority_regions": "system-watchlist-history",
        },
        "message": None,
    }
