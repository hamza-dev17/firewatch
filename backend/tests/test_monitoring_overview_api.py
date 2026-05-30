from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import app


def test_monitoring_overview_returns_curated_demo_payload() -> None:
    client = TestClient(app)

    response = client.get("/api/monitoring/overview")

    assert response.status_code == 200
    payload = response.json()

    assert payload["source_state"] == "demo"
    assert payload["data_source_labels"]["overview"] == "demo"
    assert isinstance(payload["monitoring_locations"], list)
    assert payload["monitoring_locations"]
    assert isinstance(payload["predicted_risk_hotspots"], list)
    assert payload["predicted_risk_hotspots"]
    assert isinstance(payload["regional_summaries"], list)
    assert isinstance(payload["top_priority_regions"], list)
    assert payload["top_priority_regions"]

    for hotspot in payload["predicted_risk_hotspots"]:
        if hotspot["risk_level"] in {"high", "critical"}:
            assert hotspot["data_source_label"] == "demo"
            assert "demo" in hotspot["label"].lower() or "simulated" in hotspot["label"].lower()


def test_monitoring_overview_does_not_create_prediction_history(monkeypatch, tmp_path) -> None:
    database_path = tmp_path / "firewatch-history.sqlite3"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")
    client = TestClient(app)

    overview_response = client.get("/api/monitoring/overview")
    assert overview_response.status_code == 200

    history_response = client.get("/api/history")
    assert history_response.status_code == 200
    assert history_response.json()["records"] == []
