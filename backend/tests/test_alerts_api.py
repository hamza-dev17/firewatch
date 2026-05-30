from datetime import UTC, datetime, timedelta
from pathlib import Path
import sqlite3
import sys

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import app


def test_active_alerts_are_created_only_for_live_high_and_critical_assessments(monkeypatch, tmp_path) -> None:
    from app.services.assessment import api as assessment_api

    database_path = tmp_path / "firewatch-alerts.sqlite3"
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
                    "prediction_inputs": {"temperature_c": 20.0},
                    "prediction_input_units": {"temperature_c": "C"},
                    "weather_signals": {},
                },
                {
                    "forecast_window": "24h",
                    "matched_weather_timestamp": "2026-05-11T10:00:00Z",
                    "prediction_inputs": {"temperature_c": 30.0},
                    "prediction_input_units": {"temperature_c": "C"},
                    "weather_signals": {},
                },
                {
                    "forecast_window": "48h",
                    "matched_weather_timestamp": "2026-05-12T10:00:00Z",
                    "prediction_inputs": {"temperature_c": 40.0},
                    "prediction_input_units": {"temperature_c": "C"},
                    "weather_signals": {},
                },
            ],
            "message": None,
        }

    class _StubDecisionSupportService:
        def assess_feature_vector(self, feature_values, feature_units, risk_trend, data_freshness_minutes):
            temperature = feature_values["temperature_c"]
            if temperature == 20.0:
                return self._decision("medium", 0.5, None, "increase weather review", "10 km")
            if temperature == 30.0:
                return self._decision("high", 0.74, 24, "prioritize local inspection", "20 km")
            return self._decision("critical", 0.91, 12, "immediate supervisor review", "30 km")

        def assess_risk_score(self, risk_score, model_confidence, risk_trend, data_freshness_minutes):
            if risk_score < 0.7:
                return self._decision("medium", risk_score, None, "increase weather review", "10 km")
            if risk_score < 0.85:
                return self._decision("high", risk_score, 24, "prioritize local inspection", "20 km")
            return self._decision("critical", risk_score, 12, "immediate supervisor review", "30 km")

        @staticmethod
        def _decision(risk_level, risk_score, expiry, action, radius):
            return type(
                "Decision",
                (),
                {
                    "risk_score": risk_score,
                    "model_confidence": 0.9,
                    "risk_level": risk_level,
                    "threshold_version": "runtime-thresholds-v1",
                    "recommended_action": action,
                    "monitoring_radius": radius,
                    "risk_alert_expiry_hours": expiry,
                    "recommendation_rule_version": "mvp-v1-recommendation-rules",
                    "priority_score": 80.0,
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
        json={"latitude": 39.9334, "longitude": 32.8597, "forecast_windows": ["now", "24h", "48h"]},
    )
    assert create_response.status_code == 200

    active_response = client.get("/api/alerts/active")
    assert active_response.status_code == 200
    payload = active_response.json()
    assert len(payload["alerts"]) == 2
    assert {alert["risk_level"] for alert in payload["alerts"]} == {"high", "critical"}
    assert all("System-generated risk alert" in alert["alert_text"] for alert in payload["alerts"])
    assert all("confirmed fire" not in alert["alert_text"].lower() for alert in payload["alerts"])
    assert all("official emergency" not in alert["alert_text"].lower() for alert in payload["alerts"])

    alert_by_level = {alert["risk_level"]: alert for alert in payload["alerts"]}
    for risk_level, expected_hours in (("high", 24), ("critical", 12)):
        created_at = datetime.fromisoformat(alert_by_level[risk_level]["created_at"].replace("Z", "+00:00"))
        expires_at = datetime.fromisoformat(alert_by_level[risk_level]["expires_at"].replace("Z", "+00:00"))
        assert int((expires_at - created_at).total_seconds() // 3600) == expected_hours
        assert alert_by_level[risk_level]["recommendation_rule_version"] == "mvp-v1-recommendation-rules"


def test_active_alerts_endpoint_excludes_expired_and_non_active_statuses(monkeypatch, tmp_path) -> None:
    database_path = tmp_path / "firewatch-alerts.sqlite3"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")

    client = TestClient(app)
    client.get("/api/alerts/active")

    now = datetime.now(tz=UTC)
    with sqlite3.connect(database_path) as connection:
        connection.executemany(
            """
            INSERT INTO risk_alerts (
                id, created_at, expires_at, status, recommendation_rule_version, location_name,
                latitude, longitude, forecast_window, risk_level, risk_score, recommended_action, alert_text
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    "active-valid",
                    now.isoformat().replace("+00:00", "Z"),
                    (now + timedelta(hours=2)).isoformat().replace("+00:00", "Z"),
                    "active",
                    "mvp-v1-recommendation-rules",
                    "Ankara",
                    39.9,
                    32.8,
                    "now",
                    "high",
                    0.74,
                    "prioritize local inspection",
                    "System-generated risk alert: HIGH relative wildfire risk for Ankara (now).",
                ),
                (
                    "expired",
                    now.isoformat().replace("+00:00", "Z"),
                    (now - timedelta(minutes=1)).isoformat().replace("+00:00", "Z"),
                    "active",
                    "mvp-v1-recommendation-rules",
                    "Ankara",
                    39.9,
                    32.8,
                    "24h",
                    "high",
                    0.74,
                    "prioritize local inspection",
                    "expired",
                ),
                (
                    "reviewed",
                    now.isoformat().replace("+00:00", "Z"),
                    (now + timedelta(hours=1)).isoformat().replace("+00:00", "Z"),
                    "reviewed",
                    "mvp-v1-recommendation-rules",
                    "Ankara",
                    39.9,
                    32.8,
                    "24h",
                    "high",
                    0.74,
                    "prioritize local inspection",
                    "reviewed",
                ),
            ],
        )
        connection.commit()

    response = client.get("/api/alerts/active")
    assert response.status_code == 200
    payload = response.json()
    assert [alert["id"] for alert in payload["alerts"]] == ["active-valid"]


def test_demo_monitoring_overview_never_creates_persistent_active_alerts(monkeypatch, tmp_path) -> None:
    database_path = tmp_path / "firewatch-alerts.sqlite3"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")

    client = TestClient(app)
    overview_response = client.get("/api/monitoring/overview")
    assert overview_response.status_code == 200

    alerts_response = client.get("/api/alerts/active")
    assert alerts_response.status_code == 200
    assert alerts_response.json()["alerts"] == []
