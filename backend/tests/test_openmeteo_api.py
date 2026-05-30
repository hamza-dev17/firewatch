from datetime import UTC, datetime
from pathlib import Path
import sys

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))


def test_openmeteo_build_weather_windows_payload_maps_forecast_windows(monkeypatch) -> None:
    from app.services.weather import openmeteo

    class _FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):  # noqa: ANN001
            return cls(2026, 5, 19, 10, 0, 0, tzinfo=UTC)

    class _StubOpenMeteoClient:
        def fetch_weather(self, latitude: float, longitude: float) -> dict[str, object]:
            assert latitude == 39.9334
            assert longitude == 32.8597
            return {
                "hourly": {
                    "time": [
                        "2026-05-19T10:00Z",
                        "2026-05-20T10:00Z",
                        "2026-05-21T10:00Z",
                        "2026-05-22T10:00Z",
                    ],
                    "temperature_2m": [30.0, 31.0, 32.0, 33.0],
                    "precipitation": [0.1, 0.0, 0.2, 0.5],
                    "wind_speed_10m": [5.0, 5.5, 6.0, 6.5],
                    "wind_gusts_10m": [7.0, 7.5, 8.0, 8.5],
                    "relative_humidity_2m": [40.0, 41.0, 42.0, 43.0],
                    "surface_pressure": [1008.0, 1007.0, 1006.0, 1005.0],
                    "cloud_cover": [10.0, 20.0, 30.0, 40.0],
                    "visibility": [10000.0, 9000.0, 8000.0, 7000.0],
                    "precipitation_probability": [5.0, 10.0, 20.0, 30.0],
                    "weather_code": [0, 1, 2, 3],
                },
                "daily": {
                    "time": ["2026-05-19", "2026-05-20", "2026-05-21", "2026-05-22"],
                    "temperature_2m_max": [33.0, 34.0, 35.0, 36.0],
                    "temperature_2m_min": [24.0, 25.0, 26.0, 27.0],
                },
            }

    monkeypatch.setattr(openmeteo, "datetime", _FixedDateTime)
    monkeypatch.setattr(openmeteo, "OpenMeteoClient", _StubOpenMeteoClient)

    payload = openmeteo.build_weather_window_payload(
        latitude=39.9334,
        longitude=32.8597,
        forecast_windows=["now", "24h", "48h", "72h"],
    )

    assert payload["source_state"] == "live"
    assert payload["data_source_label"] == "live-open-meteo"
    assert payload["weather_provider"] == "open-meteo"
    assert payload["message"] == "Open-Meteo weather provider is active."

    by_window = {
        item["forecast_window"]: item["matched_weather_timestamp"]
        for item in payload["forecast_windows"]
    }
    assert by_window == {
        "now": "2026-05-19T10:00:00Z",
        "24h": "2026-05-20T10:00:00Z",
        "48h": "2026-05-21T10:00:00Z",
        "72h": "2026-05-22T10:00:00Z",
    }

    first = payload["forecast_windows"][0]
    assert first["prediction_inputs"] == {
        "temperature_c": 30.0,
        "temperature_min_c": 24.0,
        "temperature_max_c": 33.0,
        "rain_mm": 0.1,
        "wind_speed_mps": 5.0,
        "wind_gust_mps": 7.0,
    }
    assert first["weather_signals"] == {
        "humidity_pct": 40.0,
        "pressure_hpa": 1008.0,
        "cloud_cover_pct": 10.0,
        "visibility_m": 10000.0,
        "weather_description": "clear sky",
        "precipitation_probability_pct": 5.0,
    }


def test_openmeteo_build_weather_windows_payload_rejects_inconsistent_hourly_arrays(monkeypatch) -> None:
    from app.services.weather import openmeteo

    class _StubOpenMeteoClient:
        def fetch_weather(self, latitude: float, longitude: float) -> dict[str, object]:
            return {
                "hourly": {
                    "time": ["2026-05-19T10:00Z", "2026-05-19T11:00Z"],
                    "temperature_2m": [30.0],
                    "precipitation": [0.1, 0.2],
                    "wind_speed_10m": [5.0, 5.5],
                    "wind_gusts_10m": [7.0, 7.5],
                    "relative_humidity_2m": [40.0, 41.0],
                    "surface_pressure": [1008.0, 1007.0],
                    "cloud_cover": [10.0, 20.0],
                    "visibility": [10000.0, 9000.0],
                    "precipitation_probability": [5.0, 10.0],
                    "weather_code": [0, 1],
                },
                "daily": {
                    "time": ["2026-05-19"],
                    "temperature_2m_max": [33.0],
                    "temperature_2m_min": [24.0],
                },
            }

    monkeypatch.setattr(openmeteo, "OpenMeteoClient", _StubOpenMeteoClient)

    with pytest.raises(openmeteo.WeatherServiceError) as error:
        openmeteo.build_weather_window_payload(
            latitude=39.9334,
            longitude=32.8597,
            forecast_windows=["now"],
        )

    assert str(error.value) == "Open-Meteo response has inconsistent hourly arrays; weather source is degraded."
