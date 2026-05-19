"""OpenWeather client and forecast-window mapping helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

import httpx

from app.core.config import get_settings
from app.services.weather.errors import WeatherServiceError
from app.services.weather.normalization import (
    build_prediction_input_units,
    build_prediction_inputs,
    build_weather_signals,
)

OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5"
SUPPORTED_FORECAST_WINDOWS = ("now", "24h", "48h", "72h")
WINDOW_OFFSET_HOURS = {"now": 0, "24h": 24, "48h": 48, "72h": 72}


@dataclass(frozen=True)
class WeatherRecord:
    timestamp: int
    payload: dict[str, object]


class OpenWeatherClient:
    """Small client boundary for OpenWeather current + forecast data."""

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key = settings.openweather_api_key
        if not self._api_key:
            raise WeatherServiceError("OpenWeather key missing; weather source is degraded.")

    def _request(self, path: str, latitude: float, longitude: float) -> dict[str, object]:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(
                f"{OPENWEATHER_BASE_URL}/{path}",
                params={
                    "lat": latitude,
                    "lon": longitude,
                    "appid": self._api_key,
                    "units": "metric",
                },
            )
        if response.status_code >= 400:
            raise WeatherServiceError("OpenWeather request failed; weather source is degraded.")

        payload = response.json()
        if not isinstance(payload, dict):
            raise WeatherServiceError("OpenWeather response is unusable; weather source is degraded.")
        return payload

    def fetch_current_weather(self, latitude: float, longitude: float) -> dict[str, object]:
        return self._request("weather", latitude, longitude)

    def fetch_forecast_weather(self, latitude: float, longitude: float) -> dict[str, object]:
        return self._request("forecast", latitude, longitude)


def _as_timestamp(payload: dict[str, object]) -> int:
    dt = payload.get("dt")
    if not isinstance(dt, int):
        raise WeatherServiceError("OpenWeather response missing timestamp; weather source is degraded.")
    return dt


def _as_forecast_records(payload: dict[str, object]) -> list[WeatherRecord]:
    items = payload.get("list")
    if not isinstance(items, list):
        raise WeatherServiceError("OpenWeather forecast response missing list; weather source is degraded.")

    records: list[WeatherRecord] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        dt = item.get("dt")
        if isinstance(dt, int):
            records.append(WeatherRecord(timestamp=dt, payload=item))

    if not records:
        raise WeatherServiceError("OpenWeather forecast list is empty; weather source is degraded.")
    return records


def _timestamp_to_iso(timestamp: int) -> str:
    return datetime.fromtimestamp(timestamp, tz=UTC).isoformat().replace("+00:00", "Z")


def _pick_nearest_record(records: list[WeatherRecord], target_timestamp: int) -> WeatherRecord:
    return min(records, key=lambda item: abs(item.timestamp - target_timestamp))


def build_weather_window_payload(
    latitude: float,
    longitude: float,
    forecast_windows: list[str],
) -> dict[str, object]:
    if not forecast_windows:
        forecast_windows = ["now"]

    for forecast_window in forecast_windows:
        if forecast_window not in SUPPORTED_FORECAST_WINDOWS:
            raise WeatherServiceError(f"Unsupported forecast window: {forecast_window}")

    client = OpenWeatherClient()
    current_payload = client.fetch_current_weather(latitude=latitude, longitude=longitude)
    forecast_payload = client.fetch_forecast_weather(latitude=latitude, longitude=longitude)

    current_timestamp = _as_timestamp(current_payload)
    forecast_records = _as_forecast_records(forecast_payload)

    window_items: list[dict[str, object]] = []
    for forecast_window in forecast_windows:
        if forecast_window == "now":
            matched_timestamp = current_timestamp
            matched_payload = current_payload
        else:
            target_timestamp = current_timestamp + WINDOW_OFFSET_HOURS[forecast_window] * 3600
            matched_record = _pick_nearest_record(forecast_records, target_timestamp)
            matched_timestamp = matched_record.timestamp
            matched_payload = matched_record.payload

        window_items.append(
            {
                "forecast_window": forecast_window,
                "matched_weather_timestamp": _timestamp_to_iso(matched_timestamp),
                "prediction_inputs": build_prediction_inputs(matched_payload, forecast_window=forecast_window),
                "prediction_input_units": build_prediction_input_units(),
                "weather_signals": build_weather_signals(matched_payload),
            }
        )

    return {
        "source_state": "live",
        "data_source_label": "live",
        "location": {"latitude": latitude, "longitude": longitude},
        "forecast_windows": window_items,
        "message": None,
    }
