from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import app
from app.services.history.repository import SqlitePredictionHistoryRepository


def test_monitoring_overview_returns_latest_live_assessment_for_each_region(monkeypatch, tmp_path) -> None:
    database_path = tmp_path / "firewatch-monitoring.sqlite3"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")
    repository = SqlitePredictionHistoryRepository(database_url=f"sqlite:///{database_path.as_posix()}")
    for assessed_at, name, latitude, longitude, risk_level, risk_score in (
        ("2026-05-31T09:00:00Z", "Ankara", 39.9334, 32.8597, "high", 0.74),
        ("2026-05-31T10:00:00Z", "Ankara", 39.9334, 32.8597, "low", 0.21),
        ("2026-05-31T10:30:00Z", "Izmir", 38.4237, 27.1428, "medium", 0.51),
    ):
        repository.save_record(
            source_state="live",
            location={"name": name, "latitude": latitude, "longitude": longitude, "source": "curated-index"},
            requested_forecast_windows=["now"],
            data_source_labels={"assessment": "live", "weather": "live", "narrative": "fallback"},
            forecast_assessments=[
                {
                    "forecast_window": "now",
                    "risk_level": risk_level,
                    "risk_score": risk_score,
                    "priority_rank": "P3",
                }
            ],
            assessment_timestamp=assessed_at,
        )

    client = TestClient(app)

    response = client.get("/api/monitoring/overview")

    assert response.status_code == 200
    payload = response.json()

    assert payload["source_state"] == "live"
    assert payload["data_source_labels"]["overview"] == "live-assessment-history"
    assert payload["predicted_risk_hotspots"] == []
    assert payload["regional_summaries"] == [
        {
            "region": "Izmir",
            "risk_level": "medium",
            "risk_score": 0.51,
            "assessed_at": "2026-05-31T10:30:00Z",
            "data_source_label": "live-assessment-history",
        },
        {
            "region": "Ankara",
            "risk_level": "low",
            "risk_score": 0.21,
            "assessed_at": "2026-05-31T10:00:00Z",
            "data_source_label": "live-assessment-history",
        },
    ]


def test_monitoring_overview_does_not_create_prediction_history(monkeypatch, tmp_path) -> None:
    database_path = tmp_path / "firewatch-history.sqlite3"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")
    client = TestClient(app)

    overview_response = client.get("/api/monitoring/overview")
    assert overview_response.status_code == 200

    history_response = client.get("/api/history")
    assert history_response.status_code == 200
    assert history_response.json()["records"] == []
