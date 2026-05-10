from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import app


def test_assessments_returns_per_window_results_with_grounded_narrative(monkeypatch) -> None:
    from app.services.assessment import api as assessment_api

    captured_payloads: list[dict[str, object]] = []

    def _stub_weather_payload(latitude: float, longitude: float, forecast_windows: list[str]) -> dict[str, object]:
        assert latitude == 39.9334
        assert longitude == 32.8597
        assert forecast_windows == ["now", "24h"]
        return {
            "source_state": "live",
            "data_source_label": "live",
            "location": {"latitude": latitude, "longitude": longitude},
            "forecast_windows": [
                {
                    "forecast_window": "now",
                    "matched_weather_timestamp": "2026-05-10T10:00:00Z",
                    "prediction_inputs": {
                        "temperature_c": 31.0,
                        "temperature_min_c": 25.0,
                        "temperature_max_c": 34.0,
                        "rain_mm": 0.0,
                        "wind_speed_mps": 6.0,
                        "wind_gust_mps": 8.0,
                    },
                    "prediction_input_units": {
                        "temperature_c": "C",
                        "temperature_min_c": "C",
                        "temperature_max_c": "C",
                        "rain_mm": "mm",
                        "wind_speed_mps": "m/s",
                        "wind_gust_mps": "m/s",
                    },
                    "weather_signals": {
                        "humidity_pct": 40.0,
                        "pressure_hpa": 1008.0,
                        "cloud_cover_pct": 5.0,
                        "visibility_m": 10000.0,
                        "weather_description": "clear sky",
                        "precipitation_probability_pct": None,
                    },
                },
                {
                    "forecast_window": "24h",
                    "matched_weather_timestamp": "2026-05-11T10:00:00Z",
                    "prediction_inputs": {
                        "temperature_c": 34.0,
                        "temperature_min_c": 26.0,
                        "temperature_max_c": 37.0,
                        "rain_mm": 0.0,
                        "wind_speed_mps": 8.0,
                        "wind_gust_mps": 11.0,
                    },
                    "prediction_input_units": {
                        "temperature_c": "C",
                        "temperature_min_c": "C",
                        "temperature_max_c": "C",
                        "rain_mm": "mm",
                        "wind_speed_mps": "m/s",
                        "wind_gust_mps": "m/s",
                    },
                    "weather_signals": {
                        "humidity_pct": 32.0,
                        "pressure_hpa": 1006.0,
                        "cloud_cover_pct": 2.0,
                        "visibility_m": 10000.0,
                        "weather_description": "sunny",
                        "precipitation_probability_pct": 0.0,
                    },
                },
            ],
            "message": None,
        }

    class _StubDecisionSupportService:
        def __init__(self) -> None:
            self.calls: list[dict[str, object]] = []

        @staticmethod
        def _medium_decision(risk_score: float, model_confidence: float | None) -> object:
            return type(
                "Decision",
                (),
                {
                    "risk_score": risk_score,
                    "model_confidence": model_confidence,
                    "risk_level": "medium",
                    "threshold_version": "runtime-thresholds-v1",
                    "recommended_action": "increase weather review",
                    "monitoring_radius": "10 km",
                    "risk_alert_expiry_hours": None,
                    "recommendation_rule_version": "mvp-v1-recommendation-rules",
                    "priority_score": 52.0,
                    "priority_rank": "P3",
                    "priority_factors": {
                        "risk_level": "medium",
                        "risk_score": 0.58,
                        "risk_trend": "stable",
                        "data_freshness_state": "fresh",
                    },
                },
            )()

        @staticmethod
        def _high_decision(risk_score: float, model_confidence: float | None) -> object:
            return type(
                "Decision",
                (),
                {
                    "risk_score": risk_score,
                    "model_confidence": model_confidence,
                    "risk_level": "high",
                    "threshold_version": "runtime-thresholds-v1",
                    "recommended_action": "prioritize local inspection",
                    "monitoring_radius": "20 km",
                    "risk_alert_expiry_hours": 24,
                    "recommendation_rule_version": "mvp-v1-recommendation-rules",
                    "priority_score": 73.0,
                    "priority_rank": "P2",
                    "priority_factors": {
                        "risk_level": "high",
                        "risk_score": 0.74,
                        "risk_trend": "rising",
                        "data_freshness_state": "fresh",
                    },
                },
            )()

        def assess_feature_vector(
            self,
            feature_values: dict[str, float],
            feature_units: dict[str, str],
            risk_trend: object,
            data_freshness_minutes: int,
        ) -> object:
            self.calls.append(
                {
                    "feature_values": feature_values,
                    "feature_units": feature_units,
                    "risk_trend": risk_trend,
                    "data_freshness_minutes": data_freshness_minutes,
                }
            )

            if feature_values["temperature_c"] == 31.0:
                return self._medium_decision(risk_score=0.58, model_confidence=0.81)
            return self._high_decision(risk_score=0.74, model_confidence=0.88)

        def assess_risk_score(
            self,
            risk_score: float,
            model_confidence: float | None,
            risk_trend: object,
            data_freshness_minutes: int,
        ) -> object:
            if risk_score == 0.58:
                return self._medium_decision(risk_score=risk_score, model_confidence=model_confidence)
            return self._high_decision(risk_score=risk_score, model_confidence=model_confidence)

    def _stub_decision_support_service_factory() -> _StubDecisionSupportService:
        return _StubDecisionSupportService()

    def _stub_narrative_builder(payload: dict[str, object]) -> dict[str, object]:
        captured_payloads.append(payload)
        assert set(payload.keys()) == {
            "location_name",
            "forecast_window",
            "matched_weather_timestamp",
            "risk_level",
            "risk_score",
            "model_confidence",
            "recommended_action",
            "monitoring_radius",
            "weather_signals",
            "data_source_label",
        }
        return {
            "narrative_explanation": f"Briefing for {payload['forecast_window']}",
            "narrative_source_label": "live",
            "narrative_source_state": "live",
        }

    monkeypatch.setattr(assessment_api, "build_weather_window_payload", _stub_weather_payload)
    monkeypatch.setattr(
        assessment_api, "build_decision_support_service", _stub_decision_support_service_factory
    )
    monkeypatch.setattr(assessment_api, "build_narrative_briefing", _stub_narrative_builder)

    client = TestClient(app)
    response = client.post(
        "/api/assessments",
        json={
            "location": {
                "name": "Ankara",
                "latitude": 39.9334,
                "longitude": 32.8597,
                "source": "curated-index",
            },
            "forecast_windows": ["now", "24h"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_state"] == "live"
    assert payload["location"] == {
        "name": "Ankara",
        "latitude": 39.9334,
        "longitude": 32.8597,
        "source": "curated-index",
    }
    assert payload["data_source_labels"] == {
        "assessment": "live",
        "weather": "live",
        "narrative": "live",
    }

    assert [item["forecast_window"] for item in payload["forecast_assessments"]] == ["now", "24h"]
    assert payload["forecast_assessments"][0]["risk_trend"] == "stable"
    assert payload["forecast_assessments"][1]["risk_trend"] == "rising"
    assert payload["forecast_assessments"][0]["model_input_drivers"] == {
        "temperature_c": 31.0,
        "temperature_min_c": 25.0,
        "temperature_max_c": 34.0,
        "rain_mm": 0.0,
        "wind_speed_mps": 6.0,
        "wind_gust_mps": 8.0,
    }
    assert "humidity_pct" not in payload["forecast_assessments"][0]["model_input_drivers"]
    assert payload["forecast_assessments"][0]["threshold_version"] == "runtime-thresholds-v1"
    assert payload["forecast_assessments"][1]["recommendation_rule_version"] == "mvp-v1-recommendation-rules"
    assert payload["forecast_assessments"][1]["narrative_explanation"] == "Briefing for 24h"
    assert len(captured_payloads) == 2


def test_assessments_accepts_direct_coordinates(monkeypatch) -> None:
    from app.services.assessment import api as assessment_api

    def _stub_weather_payload(latitude: float, longitude: float, forecast_windows: list[str]) -> dict[str, object]:
        assert latitude == 38.4237
        assert longitude == 27.1428
        assert forecast_windows == ["now"]
        return {
            "source_state": "live",
            "data_source_label": "live",
            "location": {"latitude": latitude, "longitude": longitude},
            "forecast_windows": [
                {
                    "forecast_window": "now",
                    "matched_weather_timestamp": "2026-05-10T10:00:00Z",
                    "prediction_inputs": {
                        "temperature_c": 29.0,
                        "temperature_min_c": 23.0,
                        "temperature_max_c": 32.0,
                        "rain_mm": 0.1,
                        "wind_speed_mps": 5.0,
                        "wind_gust_mps": 7.0,
                    },
                    "prediction_input_units": {
                        "temperature_c": "C",
                        "temperature_min_c": "C",
                        "temperature_max_c": "C",
                        "rain_mm": "mm",
                        "wind_speed_mps": "m/s",
                        "wind_gust_mps": "m/s",
                    },
                    "weather_signals": {
                        "humidity_pct": 48.0,
                        "pressure_hpa": 1005.0,
                        "cloud_cover_pct": 8.0,
                        "visibility_m": 10000.0,
                        "weather_description": "clear",
                        "precipitation_probability_pct": 10.0,
                    },
                }
            ],
            "message": None,
        }

    class _StubDecisionSupportService:
        def assess_feature_vector(
            self,
            feature_values: dict[str, float],
            feature_units: dict[str, str],
            risk_trend: object,
            data_freshness_minutes: int,
        ) -> object:
            return type(
                "Decision",
                (),
                {
                    "risk_score": 0.42,
                    "model_confidence": 0.73,
                    "risk_level": "medium",
                    "threshold_version": "runtime-thresholds-v1",
                    "recommended_action": "increase weather review",
                    "monitoring_radius": "10 km",
                    "risk_alert_expiry_hours": None,
                    "recommendation_rule_version": "mvp-v1-recommendation-rules",
                    "priority_score": 48.0,
                    "priority_rank": "P3",
                    "priority_factors": {},
                },
            )()

        def assess_risk_score(
            self,
            risk_score: float,
            model_confidence: float | None,
            risk_trend: object,
            data_freshness_minutes: int,
        ) -> object:
            return type(
                "Decision",
                (),
                {
                    "risk_score": risk_score,
                    "model_confidence": model_confidence,
                    "risk_level": "medium",
                    "threshold_version": "runtime-thresholds-v1",
                    "recommended_action": "increase weather review",
                    "monitoring_radius": "10 km",
                    "risk_alert_expiry_hours": None,
                    "recommendation_rule_version": "mvp-v1-recommendation-rules",
                    "priority_score": 48.0,
                    "priority_rank": "P3",
                    "priority_factors": {},
                },
            )()

    monkeypatch.setattr(assessment_api, "build_weather_window_payload", _stub_weather_payload)
    monkeypatch.setattr(assessment_api, "build_decision_support_service", lambda: _StubDecisionSupportService())
    monkeypatch.setattr(
        assessment_api,
        "build_narrative_briefing",
        lambda payload: {
            "narrative_explanation": "Template text",
            "narrative_source_label": "fallback",
            "narrative_source_state": "fallback",
        },
    )

    client = TestClient(app)
    response = client.post(
        "/api/assessments",
        json={"latitude": 38.4237, "longitude": 27.1428, "forecast_windows": ["now"]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["location"]["latitude"] == 38.4237
    assert payload["location"]["longitude"] == 27.1428
    assert payload["location"]["source"] == "direct-coordinates"
    assert payload["forecast_assessments"][0]["forecast_window"] == "now"


def test_assessments_uses_fallback_narrative_when_groq_is_unavailable(monkeypatch) -> None:
    from app.services.assessment import api as assessment_api

    class _SettingsWithoutGroqKey:
        groq_api_key = ""

    def _stub_weather_payload(latitude: float, longitude: float, forecast_windows: list[str]) -> dict[str, object]:
        return {
            "source_state": "live",
            "data_source_label": "live",
            "location": {"latitude": latitude, "longitude": longitude},
            "forecast_windows": [
                {
                    "forecast_window": "now",
                    "matched_weather_timestamp": "2026-05-10T10:00:00Z",
                    "prediction_inputs": {
                        "temperature_c": 29.0,
                        "temperature_min_c": 23.0,
                        "temperature_max_c": 32.0,
                        "rain_mm": 0.1,
                        "wind_speed_mps": 5.0,
                        "wind_gust_mps": 7.0,
                    },
                    "prediction_input_units": {
                        "temperature_c": "C",
                        "temperature_min_c": "C",
                        "temperature_max_c": "C",
                        "rain_mm": "mm",
                        "wind_speed_mps": "m/s",
                        "wind_gust_mps": "m/s",
                    },
                    "weather_signals": {
                        "humidity_pct": 48.0,
                        "pressure_hpa": 1005.0,
                        "cloud_cover_pct": 8.0,
                        "visibility_m": 10000.0,
                        "weather_description": "clear",
                        "precipitation_probability_pct": 10.0,
                    },
                }
            ],
            "message": None,
        }

    class _StubDecisionSupportService:
        def assess_feature_vector(
            self,
            feature_values: dict[str, float],
            feature_units: dict[str, str],
            risk_trend: object,
            data_freshness_minutes: int,
        ) -> object:
            return type(
                "Decision",
                (),
                {
                    "risk_score": 0.9,
                    "model_confidence": 0.95,
                    "risk_level": "critical",
                    "threshold_version": "runtime-thresholds-v1",
                    "recommended_action": "immediate supervisor review",
                    "monitoring_radius": "30 km",
                    "risk_alert_expiry_hours": 12,
                    "recommendation_rule_version": "mvp-v1-recommendation-rules",
                    "priority_score": 92.0,
                    "priority_rank": "P1",
                    "priority_factors": {},
                },
            )()

        def assess_risk_score(
            self,
            risk_score: float,
            model_confidence: float | None,
            risk_trend: object,
            data_freshness_minutes: int,
        ) -> object:
            return type(
                "Decision",
                (),
                {
                    "risk_score": risk_score,
                    "model_confidence": model_confidence,
                    "risk_level": "critical",
                    "threshold_version": "runtime-thresholds-v1",
                    "recommended_action": "immediate supervisor review",
                    "monitoring_radius": "30 km",
                    "risk_alert_expiry_hours": 12,
                    "recommendation_rule_version": "mvp-v1-recommendation-rules",
                    "priority_score": 92.0,
                    "priority_rank": "P1",
                    "priority_factors": {},
                },
            )()

    monkeypatch.setattr(assessment_api, "get_settings", lambda: _SettingsWithoutGroqKey())
    monkeypatch.setattr(assessment_api, "build_weather_window_payload", _stub_weather_payload)
    monkeypatch.setattr(assessment_api, "build_decision_support_service", lambda: _StubDecisionSupportService())

    client = TestClient(app)
    response = client.post(
        "/api/assessments",
        json={"latitude": 38.4237, "longitude": 27.1428, "forecast_windows": ["now"]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_state"] == "live"
    assert payload["data_source_labels"]["narrative"] == "fallback"
    assert payload["forecast_assessments"][0]["narrative_source_label"] == "fallback"
    assert "CRITICAL relative wildfire risk" in payload["forecast_assessments"][0]["narrative_explanation"]


def test_assessments_uses_groq_narrative_when_available(monkeypatch) -> None:
    from app.services.assessment import api as assessment_api

    captured_payloads: list[dict[str, object]] = []

    class _SettingsWithGroqKey:
        groq_api_key = "test-groq-key"

    def _stub_weather_payload(latitude: float, longitude: float, forecast_windows: list[str]) -> dict[str, object]:
        return {
            "source_state": "live",
            "data_source_label": "live",
            "location": {"latitude": latitude, "longitude": longitude},
            "forecast_windows": [
                {
                    "forecast_window": "now",
                    "matched_weather_timestamp": "2026-05-10T10:00:00Z",
                    "prediction_inputs": {
                        "temperature_c": 29.0,
                        "temperature_min_c": 23.0,
                        "temperature_max_c": 32.0,
                        "rain_mm": 0.1,
                        "wind_speed_mps": 5.0,
                        "wind_gust_mps": 7.0,
                    },
                    "prediction_input_units": {
                        "temperature_c": "C",
                        "temperature_min_c": "C",
                        "temperature_max_c": "C",
                        "rain_mm": "mm",
                        "wind_speed_mps": "m/s",
                        "wind_gust_mps": "m/s",
                    },
                    "weather_signals": {
                        "humidity_pct": 48.0,
                        "pressure_hpa": 1005.0,
                        "cloud_cover_pct": 8.0,
                        "visibility_m": 10000.0,
                        "weather_description": "clear",
                        "precipitation_probability_pct": 10.0,
                    },
                }
            ],
            "message": None,
        }

    class _StubDecisionSupportService:
        def assess_feature_vector(
            self,
            feature_values: dict[str, float],
            feature_units: dict[str, str],
            risk_trend: object,
            data_freshness_minutes: int,
        ) -> object:
            return type(
                "Decision",
                (),
                {
                    "risk_score": 0.46,
                    "model_confidence": 0.77,
                    "risk_level": "medium",
                    "threshold_version": "runtime-thresholds-v1",
                    "recommended_action": "increase weather review",
                    "monitoring_radius": "10 km",
                    "risk_alert_expiry_hours": None,
                    "recommendation_rule_version": "mvp-v1-recommendation-rules",
                    "priority_score": 50.0,
                    "priority_rank": "P3",
                    "priority_factors": {},
                },
            )()

        def assess_risk_score(
            self,
            risk_score: float,
            model_confidence: float | None,
            risk_trend: object,
            data_freshness_minutes: int,
        ) -> object:
            return type(
                "Decision",
                (),
                {
                    "risk_score": risk_score,
                    "model_confidence": model_confidence,
                    "risk_level": "medium",
                    "threshold_version": "runtime-thresholds-v1",
                    "recommended_action": "increase weather review",
                    "monitoring_radius": "10 km",
                    "risk_alert_expiry_hours": None,
                    "recommendation_rule_version": "mvp-v1-recommendation-rules",
                    "priority_score": 50.0,
                    "priority_rank": "P3",
                    "priority_factors": {},
                },
            )()

    def _stub_request_groq_narrative(payload: dict[str, object], groq_api_key: str) -> str:
        captured_payloads.append(payload)
        assert groq_api_key == "test-groq-key"
        return "Grounded narrative from Groq."

    monkeypatch.setattr(assessment_api, "get_settings", lambda: _SettingsWithGroqKey())
    monkeypatch.setattr(assessment_api, "build_weather_window_payload", _stub_weather_payload)
    monkeypatch.setattr(assessment_api, "build_decision_support_service", lambda: _StubDecisionSupportService())
    monkeypatch.setattr(assessment_api, "_request_groq_narrative", _stub_request_groq_narrative)

    client = TestClient(app)
    response = client.post(
        "/api/assessments",
        json={"latitude": 38.4237, "longitude": 27.1428, "forecast_windows": ["now"]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["data_source_labels"]["narrative"] == "live"
    assert payload["forecast_assessments"][0]["narrative_source_label"] == "live"
    assert payload["forecast_assessments"][0]["narrative_explanation"] == "Grounded narrative from Groq."
    assert len(captured_payloads) == 1
    assert set(captured_payloads[0].keys()) == {
        "location_name",
        "forecast_window",
        "matched_weather_timestamp",
        "risk_level",
        "risk_score",
        "model_confidence",
        "recommended_action",
        "monitoring_radius",
        "weather_signals",
        "data_source_label",
    }


def test_assessments_returns_degraded_when_model_is_unavailable(monkeypatch) -> None:
    from app.services.assessment import api as assessment_api

    def _stub_weather_payload(latitude: float, longitude: float, forecast_windows: list[str]) -> dict[str, object]:
        return {
            "source_state": "live",
            "data_source_label": "live",
            "location": {"latitude": latitude, "longitude": longitude},
            "forecast_windows": [],
            "message": None,
        }

    def _raise_model_unavailable() -> object:
        raise assessment_api.ModelUnavailableError("Model unavailable; assessment cannot be generated.")

    monkeypatch.setattr(assessment_api, "build_weather_window_payload", _stub_weather_payload)
    monkeypatch.setattr(assessment_api, "build_decision_support_service", _raise_model_unavailable)

    client = TestClient(app)
    response = client.post(
        "/api/assessments",
        json={"latitude": 38.4237, "longitude": 27.1428, "forecast_windows": ["now"]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_state"] == "degraded"
    assert payload["forecast_assessments"] == []
    assert payload["data_source_labels"]["assessment"] == "unavailable"
    assert payload["data_source_labels"]["weather"] == "live"
    assert payload["data_source_labels"]["narrative"] == "unavailable"
    assert payload["message"] == "Model unavailable; assessment cannot be generated."


def test_assessments_blocks_when_weather_source_is_degraded(monkeypatch) -> None:
    from app.services.assessment import api as assessment_api
    from app.services.weather.openweather import WeatherServiceError

    def _raise_weather_degraded(latitude: float, longitude: float, forecast_windows: list[str]) -> dict[str, object]:
        raise WeatherServiceError("OpenWeather request failed; weather source is degraded.")

    monkeypatch.setattr(assessment_api, "build_weather_window_payload", _raise_weather_degraded)

    client = TestClient(app)
    response = client.post(
        "/api/assessments",
        json={"latitude": 38.4237, "longitude": 27.1428, "forecast_windows": ["now"]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_state"] == "degraded"
    assert payload["forecast_assessments"] == []
    assert payload["data_source_labels"]["weather"] == "unavailable"
    assert payload["message"] == "OpenWeather request failed; weather source is degraded."


def test_assessments_persist_grouped_history_and_expose_it_via_history_api(
    monkeypatch, tmp_path
) -> None:
    from app.services.assessment import api as assessment_api

    database_path = tmp_path / "firewatch-history.sqlite3"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")

    def _stub_weather_payload(latitude: float, longitude: float, forecast_windows: list[str]) -> dict[str, object]:
        return {
            "source_state": "live",
            "data_source_label": "live",
            "location": {"latitude": latitude, "longitude": longitude},
            "forecast_windows": [
                {
                    "forecast_window": "now",
                    "matched_weather_timestamp": "2026-05-10T10:00:00Z",
                    "prediction_inputs": {
                        "temperature_c": 31.0,
                        "temperature_min_c": 25.0,
                        "temperature_max_c": 34.0,
                        "rain_mm": 0.0,
                        "wind_speed_mps": 6.0,
                        "wind_gust_mps": 8.0,
                    },
                    "prediction_input_units": {
                        "temperature_c": "C",
                        "temperature_min_c": "C",
                        "temperature_max_c": "C",
                        "rain_mm": "mm",
                        "wind_speed_mps": "m/s",
                        "wind_gust_mps": "m/s",
                    },
                    "weather_signals": {
                        "humidity_pct": 40.0,
                        "pressure_hpa": 1008.0,
                        "cloud_cover_pct": 5.0,
                        "visibility_m": 10000.0,
                        "weather_description": "clear sky",
                        "precipitation_probability_pct": None,
                    },
                },
                {
                    "forecast_window": "24h",
                    "matched_weather_timestamp": "2026-05-11T10:00:00Z",
                    "prediction_inputs": {
                        "temperature_c": 34.0,
                        "temperature_min_c": 26.0,
                        "temperature_max_c": 37.0,
                        "rain_mm": 0.0,
                        "wind_speed_mps": 8.0,
                        "wind_gust_mps": 11.0,
                    },
                    "prediction_input_units": {
                        "temperature_c": "C",
                        "temperature_min_c": "C",
                        "temperature_max_c": "C",
                        "rain_mm": "mm",
                        "wind_speed_mps": "m/s",
                        "wind_gust_mps": "m/s",
                    },
                    "weather_signals": {
                        "humidity_pct": 32.0,
                        "pressure_hpa": 1006.0,
                        "cloud_cover_pct": 2.0,
                        "visibility_m": 10000.0,
                        "weather_description": "sunny",
                        "precipitation_probability_pct": 0.0,
                    },
                },
            ],
            "message": None,
        }

    class _StubDecisionSupportService:
        def assess_feature_vector(
            self,
            feature_values: dict[str, float],
            feature_units: dict[str, str],
            risk_trend: object,
            data_freshness_minutes: int,
        ) -> object:
            if feature_values["temperature_c"] == 31.0:
                return type(
                    "Decision",
                    (),
                    {
                        "risk_score": 0.58,
                        "model_confidence": 0.81,
                        "risk_level": "medium",
                        "threshold_version": "runtime-thresholds-v1",
                        "recommended_action": "increase weather review",
                        "monitoring_radius": "10 km",
                        "risk_alert_expiry_hours": None,
                        "recommendation_rule_version": "mvp-v1-recommendation-rules",
                        "priority_score": 52.0,
                        "priority_rank": "P3",
                        "priority_factors": {},
                    },
                )()

            return type(
                "Decision",
                (),
                {
                    "risk_score": 0.74,
                    "model_confidence": 0.88,
                    "risk_level": "high",
                    "threshold_version": "runtime-thresholds-v1",
                    "recommended_action": "prioritize local inspection",
                    "monitoring_radius": "20 km",
                    "risk_alert_expiry_hours": 24,
                    "recommendation_rule_version": "mvp-v1-recommendation-rules",
                    "priority_score": 73.0,
                    "priority_rank": "P2",
                    "priority_factors": {},
                },
            )()

        def assess_risk_score(
            self,
            risk_score: float,
            model_confidence: float | None,
            risk_trend: object,
            data_freshness_minutes: int,
        ) -> object:
            if risk_score <= 0.6:
                return type(
                    "Decision",
                    (),
                    {
                        "risk_score": risk_score,
                        "model_confidence": model_confidence,
                        "risk_level": "medium",
                        "threshold_version": "runtime-thresholds-v1",
                        "recommended_action": "increase weather review",
                        "monitoring_radius": "10 km",
                        "risk_alert_expiry_hours": None,
                        "recommendation_rule_version": "mvp-v1-recommendation-rules",
                        "priority_score": 52.0,
                        "priority_rank": "P3",
                        "priority_factors": {},
                    },
                )()
            return type(
                "Decision",
                (),
                {
                    "risk_score": risk_score,
                    "model_confidence": model_confidence,
                    "risk_level": "high",
                    "threshold_version": "runtime-thresholds-v1",
                    "recommended_action": "prioritize local inspection",
                    "monitoring_radius": "20 km",
                    "risk_alert_expiry_hours": 24,
                    "recommendation_rule_version": "mvp-v1-recommendation-rules",
                    "priority_score": 73.0,
                    "priority_rank": "P2",
                    "priority_factors": {},
                },
            )()

    monkeypatch.setattr(assessment_api, "build_weather_window_payload", _stub_weather_payload)
    monkeypatch.setattr(assessment_api, "build_decision_support_service", lambda: _StubDecisionSupportService())
    monkeypatch.setattr(
        assessment_api,
        "build_narrative_briefing",
        lambda payload: {
            "narrative_explanation": f"Briefing for {payload['forecast_window']}",
            "narrative_source_label": "fallback",
            "narrative_source_state": "fallback",
        },
    )

    client = TestClient(app)
    create_response = client.post(
        "/api/assessments",
        json={
            "location": {
                "name": "Ankara",
                "latitude": 39.9334,
                "longitude": 32.8597,
                "source": "curated-index",
            },
            "forecast_windows": ["now", "24h"],
        },
    )

    assert create_response.status_code == 200
    create_payload = create_response.json()
    assert create_payload["source_state"] == "live"
    assert create_payload["prediction_history_record_id"]

    history_response = client.get("/api/history")

    assert history_response.status_code == 200
    history_payload = history_response.json()
    assert history_payload["message"] is None
    assert len(history_payload["records"]) == 1

    first_record = history_payload["records"][0]
    assert first_record["id"] == create_payload["prediction_history_record_id"]
    assert first_record["location"]["name"] == "Ankara"
    assert first_record["source_state"] == "live"
    assert first_record["requested_forecast_windows"] == ["now", "24h"]
    assert len(first_record["forecast_assessments"]) == 2
    assert first_record["forecast_assessments"][0]["forecast_window"] == "now"
    assert first_record["forecast_assessments"][1]["forecast_window"] == "24h"
    assert first_record["forecast_assessments"][1]["risk_level"] == "high"
    assert first_record["forecast_assessments"][1]["recommended_action"] == "prioritize local inspection"
    assert first_record["forecast_assessments"][1]["runtime_feature_source_state"] == "live"
    assert first_record["forecast_assessments"][1]["narrative_source_label"] == "fallback"
    assert first_record["forecast_assessments"][1]["weather_signals"]["weather_description"] == "sunny"
    assert first_record["data_source_labels"] == {
        "assessment": "live",
        "weather": "live",
        "narrative": "fallback",
    }


def test_degraded_assessment_does_not_persist_prediction_history(monkeypatch, tmp_path) -> None:
    from app.services.assessment import api as assessment_api
    from app.services.weather.openweather import WeatherServiceError

    database_path = tmp_path / "firewatch-history.sqlite3"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")

    def _raise_weather_degraded(latitude: float, longitude: float, forecast_windows: list[str]) -> dict[str, object]:
        raise WeatherServiceError("OpenWeather request failed; weather source is degraded.")

    monkeypatch.setattr(assessment_api, "build_weather_window_payload", _raise_weather_degraded)

    client = TestClient(app)
    create_response = client.post(
        "/api/assessments",
        json={"latitude": 38.4237, "longitude": 27.1428, "forecast_windows": ["now"]},
    )

    assert create_response.status_code == 200
    create_payload = create_response.json()
    assert create_payload["source_state"] == "degraded"

    history_response = client.get("/api/history")

    assert history_response.status_code == 200
    history_payload = history_response.json()
    assert history_payload["records"] == []
