"""Live national monitoring overview from latest persisted assessments."""

from __future__ import annotations

from app.services.history.repository import (
    HistoryRepositoryError,
    build_prediction_history_repository,
)


def _now_assessment(record: dict[str, object]) -> dict[str, object] | None:
    assessments = record.get("forecast_assessments")
    if not isinstance(assessments, list):
        return None
    for assessment in assessments:
        if isinstance(assessment, dict) and assessment.get("forecast_window") == "now":
            return assessment
    return None


def build_monitoring_overview_payload() -> dict[str, object]:
    try:
        records = build_prediction_history_repository().list_records()
    except HistoryRepositoryError as exc:
        return {
            "source_state": "degraded",
            "monitoring_locations": [],
            "predicted_risk_hotspots": [],
            "regional_summaries": [],
            "top_priority_regions": [],
            "data_source_labels": {"overview": "unavailable"},
            "message": str(exc),
        }

    summaries: list[dict[str, object]] = []
    seen_regions: set[str] = set()
    for record in records:
        location = record.get("location")
        assessment = _now_assessment(record)
        if not isinstance(location, dict) or assessment is None:
            continue
        region = str(location.get("name") or "").strip()
        if not region or region in seen_regions:
            continue
        seen_regions.add(region)
        summaries.append(
            {
                "region": region,
                "risk_level": str(assessment.get("risk_level") or "unknown"),
                "risk_score": float(assessment.get("risk_score") or 0.0),
                "assessed_at": str(record.get("assessment_timestamp") or ""),
                "data_source_label": "live-assessment-history",
            }
        )

    return {
        "source_state": "live",
        "monitoring_locations": [],
        "predicted_risk_hotspots": [],
        "regional_summaries": summaries,
        "top_priority_regions": [],
        "data_source_labels": {
            "overview": "live-assessment-history",
            "regional_summary": "live-assessment-history",
        },
        "message": None if summaries else "No live regional assessments yet.",
    }
