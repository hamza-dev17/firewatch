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


def test_status_exposes_runtime_feature_contract_metadata() -> None:
    client = TestClient(app)

    response = client.get("/api/status")

    assert response.status_code == 200
    payload = response.json()
    contract = payload["runtime"]["feature_contract"]

    assert contract["schema_version"] == "mvp-v1"
    assert contract["runtime_features"] == [
        "temperature_c",
        "temperature_min_c",
        "temperature_max_c",
        "rain_mm",
        "wind_speed_mps",
        "wind_gust_mps",
    ]
    assert contract["units"] == {
        "temperature_c": "C",
        "temperature_min_c": "C",
        "temperature_max_c": "C",
        "rain_mm": "mm",
        "wind_speed_mps": "m/s",
        "wind_gust_mps": "m/s",
    }
    assert contract["training_only_feature_categories"] == [
        "raw_coordinates",
        "station_metadata",
        "lagged_coordinate_fields",
        "multi_day_weather_lags",
        "ndvi",
        "soil_moisture",
        "long_historical_aggregates",
    ]


def test_status_exposes_model_artifact_evidence_without_operational_accuracy_claims() -> None:
    client = TestClient(app)

    response = client.get("/api/status")

    assert response.status_code == 200
    payload = response.json()
    evidence = payload["runtime"]["model_evidence"]

    assert evidence["model_version"] == "runtime-morocco-proxy-v1"
    assert evidence["dataset_role"] == "Proxy Training Dataset"
    assert evidence["feature_schema"] == payload["runtime"]["feature_contract"]["runtime_features"]
    assert evidence["unit_schema"] == payload["runtime"]["feature_contract"]["units"]
    assert set(evidence["candidate_models"]) == {"logistic_regression", "random_forest"}
    assert evidence["selected_algorithm"] in evidence["candidate_models"]
    assert "wildfire_recall" in evidence["validation_metrics"]
    assert "confusion_matrix" in evidence["validation_metrics"]
    assert evidence["threshold_version"] == "runtime-morocco-proxy-v1-thresholds"
    assert evidence["training_only_feature_categories"] == payload["runtime"]["feature_contract"][
        "training_only_feature_categories"
    ]
    assert "official Turkiye wildfire accuracy" in evidence["transfer_limitation"]
    assert "official fire-danger class" in evidence["transfer_limitation"]
