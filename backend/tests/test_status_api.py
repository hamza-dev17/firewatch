from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import app


def test_health_endpoint_reports_ok() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_status_reports_integration_and_runtime_states_without_secrets() -> None:
    client = TestClient(app)

    response = client.get("/api/status")

    assert response.status_code == 200
    payload = response.json()

    assert payload["service"] == "FIREWATCH DSS Backend"
    assert payload["integrations"]["mapbox"] in {"configured", "missing", "unavailable"}
    assert payload["integrations"]["openweather"] in {
        "configured",
        "missing",
        "unavailable",
    }
    assert payload["integrations"]["groq"] in {"configured", "missing", "unavailable"}
    assert payload["runtime"]["model_artifact"]["state"] in {
        "configured",
        "missing",
        "unavailable",
    }
    assert payload["runtime"]["persistence"]["state"] in {
        "configured",
        "missing",
        "unavailable",
    }
    assert payload["runtime"]["persistence"]["dialect"] == "sqlite"

    serialized_payload = str(payload)
    assert "MAPBOX_ACCESS_TOKEN" not in serialized_payload
    assert "OPENWEATHER_API_KEY" not in serialized_payload
    assert "GROQ_API_KEY" not in serialized_payload
