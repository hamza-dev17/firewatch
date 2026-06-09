"""FastAPI entry point for FIREWATCH DSS."""

from pydantic import BaseModel, Field
from fastapi import FastAPI, Query

from app.core.config import build_status_payload
from app.services.alerts.repository import (
    RiskAlertRepositoryError,
    build_risk_alert_repository,
)
from app.services.assessment.api import (
    AssessmentServiceError,
    ModelUnavailableError,
    build_assessment_assistant_answer,
    build_assessment_response,
)
from app.services.history.repository import (
    HistoryRepositoryError,
    build_prediction_history_repository,
)
from app.services.locations.search import search_locations
from app.services.monitoring.overview import build_monitoring_overview_payload
from app.services.monitoring.refresh import refresh_watchlist_assessments
from app.services.weather.openweather import build_weather_window_payload, WeatherServiceError

app = FastAPI(title="FIREWATCH DSS API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/status")
def api_status() -> dict[str, object]:
    return build_status_payload()


@app.get("/api/locations/search")
def location_search(q: str) -> dict[str, object]:
    results = [result.__dict__ for result in search_locations(q)]
    return {
        "query": q,
        "results": results,
        "message": None if results else "No location search results found.",
    }


class WeatherWindowRequest(BaseModel):
    latitude: float
    longitude: float
    forecast_windows: list[str] = Field(default_factory=lambda: ["now", "24h", "48h", "72h"])


@app.post("/api/weather/windows")
def weather_windows(request: WeatherWindowRequest) -> dict[str, object]:
    try:
        return build_weather_window_payload(
            latitude=request.latitude,
            longitude=request.longitude,
            forecast_windows=request.forecast_windows,
        )
    except WeatherServiceError as exc:
        return {
            "source_state": "degraded",
            "data_source_label": "unavailable",
            "forecast_windows": [],
            "message": str(exc),
        }


class AssessmentLocation(BaseModel):
    name: str | None = None
    latitude: float
    longitude: float
    source: str | None = None


class AssessmentRequest(BaseModel):
    location: AssessmentLocation | None = None
    latitude: float | None = None
    longitude: float | None = None
    forecast_windows: list[str] = Field(default_factory=lambda: ["now", "24h", "48h", "72h"])
    model_algorithm: str | None = None


@app.post("/api/assessments")
def create_assessment(request: AssessmentRequest) -> dict[str, object]:
    location: dict[str, object]
    if request.location is not None:
        location = request.location.model_dump(exclude_none=True)
    elif request.latitude is not None and request.longitude is not None:
        location = {
            "latitude": request.latitude,
            "longitude": request.longitude,
            "name": None,
            "source": "direct-coordinates",
        }
    else:
        return {
            "source_state": "degraded",
            "forecast_assessments": [],
            "data_source_labels": {
                "assessment": "unavailable",
                "weather": "unavailable",
                "narrative": "unavailable",
            },
            "message": "Assessment request requires a location object or latitude/longitude.",
        }

    try:
        return build_assessment_response(
            location=location,
            forecast_windows=request.forecast_windows,
            model_algorithm=request.model_algorithm,
        )
    except ModelUnavailableError as exc:
        return {
            "source_state": "degraded",
            "location": location,
            "forecast_assessments": [],
            "data_source_labels": {
                "assessment": "unavailable",
                "weather": "unavailable",
                "narrative": "unavailable",
            },
            "message": str(exc),
        }
    except (WeatherServiceError, AssessmentServiceError) as exc:
        return {
            "source_state": "degraded",
            "location": location,
            "forecast_assessments": [],
            "data_source_labels": {
                "assessment": "unavailable",
                "weather": "unavailable",
                "narrative": "unavailable",
            },
            "message": str(exc),
        }


class AssessmentAssistantRequest(BaseModel):
    question: str
    location_name: str | None = None
    forecast_window: str
    assessment: dict[str, object]
    forecast_assessments: list[dict[str, object]] | None = None
    data_source_labels: dict[str, object] = Field(default_factory=dict)


@app.post("/api/assessment-assistant")
def assessment_assistant(request: AssessmentAssistantRequest) -> dict[str, object]:
    return build_assessment_assistant_answer(request.model_dump())


@app.get("/api/history")
def prediction_history(
    region: str | None = None,
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    risk_level: str | None = Query(default=None),
    show_archived: bool = Query(default=False),
) -> dict[str, object]:
    try:
        history_repository = build_prediction_history_repository()
        records = history_repository.list_records(
            region=region,
            start_date=start_date,
            end_date=end_date,
            risk_level=risk_level,
            show_archived=show_archived,
        )
    except HistoryRepositoryError as exc:
        return {"records": [], "message": str(exc)}

    return {
        "records": records,
        "message": None if records else "No prediction history records found.",
    }


@app.post("/api/history/{record_id}/archive")
def archive_prediction_history(record_id: str) -> dict[str, object]:
    try:
        history_repository = build_prediction_history_repository()
        archived_record_id = history_repository.archive_record(record_id)
    except HistoryRepositoryError as exc:
        return {"archived_record_id": None, "message": str(exc)}

    return {
        "archived_record_id": archived_record_id,
        "message": "Prediction history record archived.",
    }


@app.get("/api/monitoring/overview")
def monitoring_overview() -> dict[str, object]:
    return build_monitoring_overview_payload()


@app.post("/api/monitoring/refresh")
def refresh_monitoring() -> dict[str, object]:
    return refresh_watchlist_assessments()


@app.get("/api/alerts/active")
def active_risk_alerts() -> dict[str, object]:
    try:
        alert_repository = build_risk_alert_repository()
        alerts = alert_repository.list_active_alerts()
    except RiskAlertRepositoryError as exc:
        return {"alerts": [], "message": str(exc)}

    return {
        "alerts": alerts,
        "message": None if alerts else "No active risk alerts.",
    }
