"""FastAPI entry point for FIREWATCH DSS."""

from pydantic import BaseModel, Field
from fastapi import FastAPI

from app.core.config import build_status_payload
from app.services.assessment.api import (
    AssessmentServiceError,
    ModelUnavailableError,
    build_assessment_response,
)
from app.services.history.repository import (
    HistoryRepositoryError,
    build_prediction_history_repository,
)
from app.services.locations.search import search_locations
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
        return build_assessment_response(location=location, forecast_windows=request.forecast_windows)
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


@app.get("/api/history")
def prediction_history() -> dict[str, object]:
    try:
        history_repository = build_prediction_history_repository()
        records = history_repository.list_records()
    except HistoryRepositoryError as exc:
        return {"records": [], "message": str(exc)}

    return {
        "records": records,
        "message": None if records else "No prediction history records found.",
    }
