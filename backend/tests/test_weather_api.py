from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import app


class _StubWeatherClient:
    def __init__(self) -> None:
        self.current_payload = {
            "dt": 1_700_000_000,
            "main": {"temp": 30.0, "temp_min": 28.0, "temp_max": 33.0, "humidity": 45, "pressure": 1007},
            "wind": {"speed": 5.0, "gust": 8.0},
            "clouds": {"all": 10},
            "visibility": 10000,
            "weather": [{"description": "clear sky"}],
            "rain": {"1h": 0.3},
        }
        self.forecast_payload = {
            "list": [
                {
                    "dt": 1_700_086_000,
                    "main": {"temp": 29.0, "temp_min": 26.0, "temp_max": 31.0, "humidity": 47, "pressure": 1008},
                    "wind": {"speed": 5.6, "gust": 8.2},
                    "clouds": {"all": 12},
                    "visibility": 9000,
                    "weather": [{"description": "few clouds"}],
                    "rain": {"3h": 0.0},
                    "pop": 0.1,
                },
                {
                    "dt": 1_700_172_000,
                    "main": {"temp": 31.0, "temp_min": 27.0, "temp_max": 34.0, "humidity": 43, "pressure": 1005},
                    "wind": {"speed": 6.2, "gust": 9.0},
                    "clouds": {"all": 15},
                    "visibility": 8000,
                    "weather": [{"description": "scattered clouds"}],
                    "rain": {"3h": 0.6},
                    "pop": 0.4,
                },
                {
                    "dt": 1_700_258_000,
                    "main": {"temp": 28.0, "temp_min": 25.0, "temp_max": 30.0, "humidity": 51, "pressure": 1010},
                    "wind": {"speed": 4.4, "gust": 6.8},
                    "clouds": {"all": 35},
                    "visibility": 7000,
                    "weather": [{"description": "light rain"}],
                    "rain": {"3h": 1.2},
                    "pop": 0.8,
                },
            ]
        }

    def fetch_current_weather(self, latitude: float, longitude: float) -> dict[str, object]:
        return self.current_payload

    def fetch_forecast_weather(self, latitude: float, longitude: float) -> dict[str, object]:
        return self.forecast_payload


def test_weather_windows_maps_forecast_windows_to_nearest_records(monkeypatch) -> None:
    from app.services.weather import openweather

    monkeypatch.setattr(openweather, "OpenWeatherClient", _StubWeatherClient)

    client = TestClient(app)
    response = client.post(
        "/api/weather/windows",
        json={
            "latitude": 39.9334,
            "longitude": 32.8597,
            "forecast_windows": ["now", "24h", "48h", "72h"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_state"] == "live"

    by_window = {
        item["forecast_window"]: item["matched_weather_timestamp"]
        for item in payload["forecast_windows"]
    }
    assert by_window == {
        "now": "2023-11-14T22:13:20Z",
        "24h": "2023-11-15T22:06:40Z",
        "48h": "2023-11-16T22:00:00Z",
        "72h": "2023-11-17T21:53:20Z",
    }


def test_weather_windows_splits_prediction_inputs_and_display_signals(monkeypatch) -> None:
    from app.services.weather import openweather

    monkeypatch.setattr(openweather, "OpenWeatherClient", _StubWeatherClient)

    client = TestClient(app)
    response = client.post(
        "/api/weather/windows",
        json={
            "latitude": 39.9334,
            "longitude": 32.8597,
            "forecast_windows": ["now"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    first = payload["forecast_windows"][0]

    assert first["prediction_inputs"] == {
        "temperature_c": 30.0,
        "temperature_min_c": 28.0,
        "temperature_max_c": 33.0,
        "rain_mm": 0.3,
        "wind_speed_mps": 5.0,
        "wind_gust_mps": 8.0,
    }
    assert first["prediction_input_units"] == {
        "temperature_c": "C",
        "temperature_min_c": "C",
        "temperature_max_c": "C",
        "rain_mm": "mm",
        "wind_speed_mps": "m/s",
        "wind_gust_mps": "m/s",
    }
    assert first["weather_signals"] == {
        "humidity_pct": 45.0,
        "pressure_hpa": 1007.0,
        "cloud_cover_pct": 10.0,
        "visibility_m": 10000.0,
        "weather_description": "clear sky",
        "precipitation_probability_pct": None,
    }


def test_weather_windows_reports_degraded_when_openweather_key_is_missing(monkeypatch) -> None:
    from app.services.weather import openweather

    class _SettingsWithoutWeatherKey:
        openweather_api_key = ""

    monkeypatch.setattr(openweather, "get_settings", lambda: _SettingsWithoutWeatherKey())

    client = TestClient(app)
    response = client.post(
        "/api/weather/windows",
        json={"latitude": 39.9334, "longitude": 32.8597, "forecast_windows": ["now"]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_state"] == "degraded"
    assert payload["data_source_label"] == "unavailable"
    assert payload["forecast_windows"] == []
    assert payload["message"] == "OpenWeather key missing; weather source is degraded."


def test_weather_windows_reports_degraded_when_openweather_call_fails(monkeypatch) -> None:
    from app.services.weather import openweather

    class _FailingWeatherClient:
        def fetch_current_weather(self, latitude: float, longitude: float) -> dict[str, object]:
            raise openweather.WeatherServiceError(
                "OpenWeather request failed; weather source is degraded."
            )

        def fetch_forecast_weather(self, latitude: float, longitude: float) -> dict[str, object]:
            raise AssertionError("forecast call should not run when current weather call fails")

    monkeypatch.setattr(openweather, "OpenWeatherClient", _FailingWeatherClient)

    client = TestClient(app)
    response = client.post(
        "/api/weather/windows",
        json={"latitude": 39.9334, "longitude": 32.8597, "forecast_windows": ["24h"]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_state"] == "degraded"
    assert payload["data_source_label"] == "unavailable"
    assert payload["forecast_windows"] == []
    assert payload["message"] == "OpenWeather request failed; weather source is degraded."


def test_weather_windows_reports_degraded_for_unusable_weather_payload(monkeypatch) -> None:
    from app.services.weather import openweather

    class _UnusablePayloadClient:
        def fetch_current_weather(self, latitude: float, longitude: float) -> dict[str, object]:
            return {"main": {"temp": 30.0}}

        def fetch_forecast_weather(self, latitude: float, longitude: float) -> dict[str, object]:
            return {"list": []}

    monkeypatch.setattr(openweather, "OpenWeatherClient", _UnusablePayloadClient)

    client = TestClient(app)
    response = client.post(
        "/api/weather/windows",
        json={"latitude": 39.9334, "longitude": 32.8597, "forecast_windows": ["now"]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_state"] == "degraded"
    assert payload["data_source_label"] == "unavailable"
    assert payload["forecast_windows"] == []
    assert payload["message"] == "OpenWeather response missing timestamp; weather source is degraded."
