"""Open-Meteo client and forecast-window mapping helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from json import JSONDecodeError

import httpx

from app.services.weather.errors import WeatherServiceError
from app.services.weather.normalization import (
    build_prediction_input_units,
    build_prediction_inputs,
    build_weather_signals,
)

OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast"
SUPPORTED_FORECAST_WINDOWS = ("now", "24h", "48h", "72h")
WINDOW_OFFSET_HOURS = {"now": 0, "24h": 24, "48h": 48, "72h": 72}
_WMO_DESCRIPTIONS = {
    0: "clear sky",
    1: "mainly clear",
    2: "partly cloudy",
    3: "overcast",
    45: "fog",
    48: "rime fog",
    51: "light drizzle",
    53: "moderate drizzle",
    55: "dense drizzle",
    56: "light freezing drizzle",
    57: "dense freezing drizzle",
    61: "slight rain",
    63: "moderate rain",
    65: "heavy rain",
    66: "light freezing rain",
    67: "heavy freezing rain",
    71: "slight snow",
    73: "moderate snow",
    75: "heavy snow",
    77: "snow grains",
    80: "slight rain showers",
    81: "moderate rain showers",
    82: "violent rain showers",
    85: "slight snow showers",
    86: "heavy snow showers",
    95: "thunderstorm",
    96: "thunderstorm with slight hail",
    99: "thunderstorm with heavy hail",
}


@dataclass(frozen=True)
class WeatherRecord:
    timestamp: int
    payload: dict[str, object]


class OpenMeteoClient:
    """Small client boundary for Open-Meteo forecast data."""

    def _request(self, latitude: float, longitude: float) -> dict[str, object]:
        try:
            with httpx.Client(timeout=10.0, trust_env=False) as client:
                response = client.get(
                    OPEN_METEO_BASE_URL,
                    params={
                        "latitude": latitude,
                        "longitude": longitude,
                        "hourly": ",".join(
                            [
                                "temperature_2m",
                                "precipitation",
                                "wind_speed_10m",
                                "wind_gusts_10m",
                                "relative_humidity_2m",
                                "surface_pressure",
                                "cloud_cover",
                                "visibility",
                                "precipitation_probability",
                                "weather_code",
                            ]
                        ),
                        "daily": "temperature_2m_max,temperature_2m_min",
                        "forecast_days": 5,
                        "temperature_unit": "celsius",
                        "wind_speed_unit": "ms",
                        "precipitation_unit": "mm",
                        "timezone": "UTC",
                    },
                )
        except httpx.RequestError as exc:
            raise WeatherServiceError(
                "Open-Meteo request failed; weather source is degraded. "
                f"{exc.__class__.__name__}: {exc}"
            ) from exc

        if response.status_code >= 400:
            raise WeatherServiceError(_format_http_error(response))

        try:
            payload = response.json()
        except JSONDecodeError as exc:
            raise WeatherServiceError(
                "Open-Meteo response is unusable; weather source is degraded. "
                f"Invalid JSON payload: {exc}"
            ) from exc

        if not isinstance(payload, dict):
            raise WeatherServiceError("Open-Meteo response is unusable; weather source is degraded.")
        return payload

    def fetch_weather(self, latitude: float, longitude: float) -> dict[str, object]:
        return self._request(latitude=latitude, longitude=longitude)


def _as_mapping(payload: dict[str, object], key: str) -> dict[str, object]:
    raw = payload.get(key)
    if not isinstance(raw, dict):
        raise WeatherServiceError(f"Open-Meteo response missing {key}; weather source is degraded.")
    return raw


def _as_number(value: object) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _as_sequence(mapping: dict[str, object], key: str) -> list[object]:
    value = mapping.get(key)
    if not isinstance(value, list):
        raise WeatherServiceError(
            f"Open-Meteo response missing hourly {key}; weather source is degraded."
        )
    return value


def _parse_timestamp(iso_timestamp: object) -> int:
    if not isinstance(iso_timestamp, str):
        raise WeatherServiceError("Open-Meteo response has invalid time records; weather source is degraded.")
    try:
        parsed = datetime.fromisoformat(iso_timestamp.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError as exc:
        raise WeatherServiceError(
            "Open-Meteo response has invalid time records; weather source is degraded."
        ) from exc
    return int(parsed.timestamp())


def _daily_min_max_by_date(payload: dict[str, object]) -> dict[str, tuple[float | None, float | None]]:
    daily = _as_mapping(payload, "daily")
    daily_times = _as_sequence(daily, "time")
    max_values = _as_sequence(daily, "temperature_2m_max")
    min_values = _as_sequence(daily, "temperature_2m_min")

    if len(daily_times) != len(max_values) or len(daily_times) != len(min_values):
        raise WeatherServiceError(
            "Open-Meteo response has inconsistent daily arrays; weather source is degraded."
        )

    mapped: dict[str, tuple[float | None, float | None]] = {}
    for day, max_value, min_value in zip(daily_times, max_values, min_values):
        if isinstance(day, str):
            mapped[day] = (_as_number(max_value), _as_number(min_value))
    return mapped


def _weather_description_from_code(code_value: float | None) -> str | None:
    if code_value is None:
        return None
    return _WMO_DESCRIPTIONS.get(int(code_value))


def _hourly_records(payload: dict[str, object]) -> list[WeatherRecord]:
    hourly = _as_mapping(payload, "hourly")

    times = _as_sequence(hourly, "time")
    temperatures = _as_sequence(hourly, "temperature_2m")
    precipitation = _as_sequence(hourly, "precipitation")
    wind_speeds = _as_sequence(hourly, "wind_speed_10m")
    wind_gusts = _as_sequence(hourly, "wind_gusts_10m")
    humidity = _as_sequence(hourly, "relative_humidity_2m")
    pressure = _as_sequence(hourly, "surface_pressure")
    cloud_cover = _as_sequence(hourly, "cloud_cover")
    visibility = _as_sequence(hourly, "visibility")
    precipitation_probability = _as_sequence(hourly, "precipitation_probability")
    weather_code = _as_sequence(hourly, "weather_code")

    sizes = {
        len(times),
        len(temperatures),
        len(precipitation),
        len(wind_speeds),
        len(wind_gusts),
        len(humidity),
        len(pressure),
        len(cloud_cover),
        len(visibility),
        len(precipitation_probability),
        len(weather_code),
    }
    if len(sizes) != 1:
        raise WeatherServiceError("Open-Meteo response has inconsistent hourly arrays; weather source is degraded.")

    date_min_max = _daily_min_max_by_date(payload)
    records: list[WeatherRecord] = []

    for index, time_item in enumerate(times):
        timestamp = _parse_timestamp(time_item)
        temp_value = _as_number(temperatures[index])
        wind_speed_value = _as_number(wind_speeds[index])

        if temp_value is None or wind_speed_value is None:
            continue

        date_key = datetime.fromtimestamp(timestamp, tz=UTC).strftime("%Y-%m-%d")
        max_temp, min_temp = date_min_max.get(date_key, (None, None))
        weather_code_value = _as_number(weather_code[index])
        rain_mm = _as_number(precipitation[index])
        pop_pct = _as_number(precipitation_probability[index])
        wind_gust_value = _as_number(wind_gusts[index])
        weather_description = _weather_description_from_code(weather_code_value)

        normalized = {
            "dt": timestamp,
            "main": {
                "temp": temp_value,
                "temp_min": min_temp if min_temp is not None else temp_value,
                "temp_max": max_temp if max_temp is not None else temp_value,
                "humidity": _as_number(humidity[index]),
                "pressure": _as_number(pressure[index]),
            },
            "wind": {
                "speed": wind_speed_value,
                "gust": wind_gust_value if wind_gust_value is not None else wind_speed_value,
            },
            "clouds": {"all": _as_number(cloud_cover[index])},
            "visibility": _as_number(visibility[index]),
            "weather": [{"description": weather_description}] if weather_description is not None else [],
            "rain": {"1h": rain_mm if rain_mm is not None else 0.0},
            "pop": (pop_pct / 100.0) if pop_pct is not None else None,
        }
        records.append(WeatherRecord(timestamp=timestamp, payload=normalized))

    if not records:
        raise WeatherServiceError("Open-Meteo forecast list is empty; weather source is degraded.")
    return records


def _timestamp_to_iso(timestamp: int) -> str:
    return datetime.fromtimestamp(timestamp, tz=UTC).isoformat().replace("+00:00", "Z")


def _format_http_error(response: httpx.Response) -> str:
    detail_parts: list[str] = []

    try:
        payload = response.json()
    except JSONDecodeError:
        payload = None

    if isinstance(payload, dict):
        reason = payload.get("reason")
        if isinstance(reason, str) and reason.strip():
            detail_parts.append(reason.strip())
    elif isinstance(response.text, str) and response.text.strip():
        detail_parts.append(response.text.strip()[:160])

    if detail_parts:
        return (
            "Open-Meteo request failed; weather source is degraded. "
            f"HTTP {response.status_code}: {detail_parts[0]}"
        )

    return f"Open-Meteo request failed; weather source is degraded. HTTP {response.status_code}"


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

    client = OpenMeteoClient()
    raw_payload = client.fetch_weather(latitude=latitude, longitude=longitude)
    records = _hourly_records(raw_payload)

    reference_timestamp = int(datetime.now(tz=UTC).timestamp())
    current_record = _pick_nearest_record(records, reference_timestamp)
    current_timestamp = current_record.timestamp

    window_items: list[dict[str, object]] = []
    for forecast_window in forecast_windows:
        target_timestamp = current_timestamp + WINDOW_OFFSET_HOURS[forecast_window] * 3600
        matched_record = _pick_nearest_record(records, target_timestamp)
        matched_payload = matched_record.payload

        window_items.append(
            {
                "forecast_window": forecast_window,
                "matched_weather_timestamp": _timestamp_to_iso(matched_record.timestamp),
                "prediction_inputs": build_prediction_inputs(
                    matched_payload, forecast_window=forecast_window, provider_name="Open-Meteo"
                ),
                "prediction_input_units": build_prediction_input_units(),
                "weather_signals": build_weather_signals(matched_payload, provider_name="Open-Meteo"),
            }
        )

    return {
        "source_state": "live",
        "data_source_label": "live-open-meteo",
        "weather_provider": "open-meteo",
        "location": {"latitude": latitude, "longitude": longitude},
        "forecast_windows": window_items,
        "message": "Open-Meteo weather provider is active.",
    }
