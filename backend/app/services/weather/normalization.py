"""Normalization helpers for weather payloads used by runtime assessment."""

from __future__ import annotations

from app.services.features.runtime_contract import RUNTIME_FEATURE_UNITS

from .errors import WeatherServiceError


def as_mapping(payload: dict[str, object], key: str, *, provider_name: str = "OpenWeather") -> dict[str, object]:
    raw_value = payload.get(key)
    if not isinstance(raw_value, dict):
        raise WeatherServiceError(f"{provider_name} response missing {key}; weather source is degraded.")
    return raw_value


def as_number(value: object) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None


def build_prediction_inputs(
    payload: dict[str, object], forecast_window: str, *, provider_name: str = "OpenWeather"
) -> dict[str, float]:
    main = as_mapping(payload, "main", provider_name=provider_name)
    wind = as_mapping(payload, "wind", provider_name=provider_name)
    rain = payload.get("rain")
    rain_mapping = rain if isinstance(rain, dict) else {}

    temperature_c = as_number(main.get("temp"))
    temperature_min_c = as_number(main.get("temp_min"))
    temperature_max_c = as_number(main.get("temp_max"))
    wind_speed_mps = as_number(wind.get("speed"))

    if (
        temperature_c is None
        or temperature_min_c is None
        or temperature_max_c is None
        or wind_speed_mps is None
    ):
        raise WeatherServiceError(
            f"{provider_name} response missing required runtime feature fields for {forecast_window}; weather source is degraded."
        )

    rain_mm = as_number(rain_mapping.get("1h"))
    if rain_mm is None:
        rain_mm = as_number(rain_mapping.get("3h"))
    if rain_mm is None:
        rain_mm = 0.0

    wind_gust_mps = as_number(wind.get("gust"))
    if wind_gust_mps is None:
        wind_gust_mps = wind_speed_mps

    return {
        "temperature_c": temperature_c,
        "temperature_min_c": temperature_min_c,
        "temperature_max_c": temperature_max_c,
        "rain_mm": rain_mm,
        "wind_speed_mps": wind_speed_mps,
        "wind_gust_mps": wind_gust_mps,
    }


def build_weather_signals(payload: dict[str, object], *, provider_name: str = "OpenWeather") -> dict[str, object]:
    main = as_mapping(payload, "main", provider_name=provider_name)
    clouds = payload.get("clouds")
    clouds_mapping = clouds if isinstance(clouds, dict) else {}

    weather_description: str | None = None
    weather_items = payload.get("weather")
    if isinstance(weather_items, list) and weather_items:
        first = weather_items[0]
        if isinstance(first, dict):
            description = first.get("description")
            if isinstance(description, str):
                weather_description = description

    precipitation_probability_pct: float | None = None
    pop_value = as_number(payload.get("pop"))
    if pop_value is not None:
        precipitation_probability_pct = pop_value * 100.0

    return {
        "humidity_pct": as_number(main.get("humidity")),
        "pressure_hpa": as_number(main.get("pressure")),
        "cloud_cover_pct": as_number(clouds_mapping.get("all")),
        "visibility_m": as_number(payload.get("visibility")),
        "weather_description": weather_description,
        "precipitation_probability_pct": precipitation_probability_pct,
    }


def build_prediction_input_units() -> dict[str, str]:
    return dict(RUNTIME_FEATURE_UNITS)
