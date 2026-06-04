from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import app
from app.services.history.repository import SqlitePredictionHistoryRepository


def _save_history_record(
    repository: SqlitePredictionHistoryRepository,
    *,
    location_name: str,
    risk_level: str,
    assessment_timestamp: str,
) -> str:
    return repository.save_record(
        source_state="live",
        location={
            "name": location_name,
            "latitude": 39.9334,
            "longitude": 32.8597,
            "source": "curated-index",
        },
        requested_forecast_windows=["now", "24h"],
        data_source_labels={
            "assessment": "live",
            "weather": "live",
            "narrative": "fallback",
        },
        forecast_assessments=[
            {
                "forecast_window": "now",
                "matched_weather_timestamp": assessment_timestamp,
                "risk_score": 0.74,
                "risk_level": risk_level,
                "recommended_action": "prioritize local inspection",
                "risk_alert_status": "active" if risk_level in {"high", "critical"} else "not-created",
                "runtime_feature_source_state": "live",
                "narrative_source_label": "fallback",
                "weather_signals": {
                    "temperature_c": 34.0,
                    "humidity_pct": 32.0,
                    "weather_description": "sunny",
                },
            }
        ],
        assessment_timestamp=assessment_timestamp,
    )


def test_history_api_filters_grouped_prediction_history_records(monkeypatch, tmp_path) -> None:
    database_path = tmp_path / "firewatch-history.sqlite3"
    database_url = f"sqlite:///{database_path.as_posix()}"
    monkeypatch.setenv("DATABASE_URL", database_url)

    repository = SqlitePredictionHistoryRepository(database_url=database_url)
    ankara_record_id = _save_history_record(
        repository,
        location_name="Ankara, Turkiye",
        risk_level="high",
        assessment_timestamp="2026-05-10T10:00:00Z",
    )
    _save_history_record(
        repository,
        location_name="Izmir, Turkiye",
        risk_level="medium",
        assessment_timestamp="2026-05-12T10:00:00Z",
    )

    response = TestClient(app).get(
        "/api/history",
        params={
            "region": "ankara",
            "start_date": "2026-05-10",
            "end_date": "2026-05-10",
            "risk_level": "high",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["message"] is None
    assert [record["id"] for record in payload["records"]] == [ankara_record_id]
    assert payload["records"][0]["location"]["name"] == "Ankara, Turkiye"
    assert payload["records"][0]["forecast_assessments"][0]["risk_level"] == "high"


def test_history_api_archives_records_and_hides_them_by_default(monkeypatch, tmp_path) -> None:
    database_path = tmp_path / "firewatch-history.sqlite3"
    database_url = f"sqlite:///{database_path.as_posix()}"
    monkeypatch.setenv("DATABASE_URL", database_url)

    repository = SqlitePredictionHistoryRepository(database_url=database_url)
    archived_record_id = _save_history_record(
        repository,
        location_name="Ankara, Turkiye",
        risk_level="medium",
        assessment_timestamp="2026-05-10T10:00:00Z",
    )

    client = TestClient(app)
    archive_response = client.post(f"/api/history/{archived_record_id}/archive")

    assert archive_response.status_code == 200
    assert archive_response.json()["archived_record_id"] == archived_record_id

    visible_response = client.get("/api/history")
    assert visible_response.status_code == 200
    assert visible_response.json()["records"] == []

    archived_response = client.get("/api/history", params={"show_archived": "true"})
    assert archived_response.status_code == 200
    archived_payload = archived_response.json()
    assert [record["id"] for record in archived_payload["records"]] == [archived_record_id]
    assert archived_payload["records"][0]["archived_at"] is not None
