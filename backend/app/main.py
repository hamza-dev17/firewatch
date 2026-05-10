"""FastAPI entry point for FIREWATCH DSS."""

from pydantic import BaseModel, Field
from fastapi import FastAPI

from app.core.config import build_status_payload
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
