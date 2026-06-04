from pathlib import Path
import sys
from datetime import UTC, datetime

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import app
from app.services.history.repository import SqlitePredictionHistoryRepository
from app.services.monitoring import refresh as monitoring_refresh
from app.services.monitoring.watchlist import get_watch_locations


def test_monitoring_overview_returns_latest_assessment_for_watched_regions(monkeypatch, tmp_path) -> None:
    database_path = tmp_path / "firewatch-monitoring.sqlite3"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")
    repository = SqlitePredictionHistoryRepository(database_url=f"sqlite:///{database_path.as_posix()}")
    for assessed_at, name, latitude, longitude, risk_level, risk_score in (
        ("2026-05-31T09:00:00Z", "Ankara", 39.9334, 32.8597, "high", 0.74),
        ("2026-05-31T10:00:00Z", "Antalya", 36.8969, 30.7133, "low", 0.21),
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
    assert payload["data_source_labels"]["overview"] == "system-watchlist-history"
    assert payload["data_source_labels"]["monitoring_locations"] == "system-watchlist"
    assert len(payload["monitoring_locations"]) == 10
    assert payload["predicted_risk_hotspots"] == []
    assert len(payload["regional_summaries"]) == 10
    assert payload["regional_summaries"][:2] == [
        {
            "region": "Izmir",
            "risk_level": "medium",
            "risk_score": 0.51,
            "priority_rank": "P3",
            "assessed_at": "2026-05-31T10:30:00Z",
            "data_source_label": "system-watchlist-history",
        },
        {
            "region": "Antalya",
            "risk_level": "low",
            "risk_score": 0.21,
            "priority_rank": "P3",
            "assessed_at": "2026-05-31T10:00:00Z",
            "data_source_label": "system-watchlist-history",
        },
    ]
    pending_regions = payload["regional_summaries"][2:]
    assert len(pending_regions) == 8
    assert {summary["risk_level"] for summary in pending_regions} == {"pending"}
    assert {summary["data_source_label"] for summary in pending_regions} == {"system-watchlist"}
    assert payload["top_priority_regions"][:2] == [
        {
            "region": "Izmir",
            "priority_rank": "P3",
            "risk_level": "medium",
            "risk_score": 0.51,
            "data_source_label": "system-watchlist-history",
        },
        {
            "region": "Antalya",
            "priority_rank": "P3",
            "risk_level": "low",
            "risk_score": 0.21,
            "data_source_label": "system-watchlist-history",
        },
    ]
    assert len(payload["top_priority_regions"]) == 10


def test_monitoring_overview_returns_pending_watchlist_without_assessments(monkeypatch, tmp_path) -> None:
    database_path = tmp_path / "firewatch-empty-monitoring.sqlite3"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")
    client = TestClient(app)

    response = client.get("/api/monitoring/overview")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["monitoring_locations"]) == 10
    assert len(payload["regional_summaries"]) == 10
    assert {summary["risk_level"] for summary in payload["regional_summaries"]} == {"pending"}
    assert payload["message"] is None


def test_monitoring_overview_does_not_create_prediction_history(monkeypatch, tmp_path) -> None:
    database_path = tmp_path / "firewatch-history.sqlite3"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")
    client = TestClient(app)

    overview_response = client.get("/api/monitoring/overview")
    assert overview_response.status_code == 200

    history_response = client.get("/api/history")
    assert history_response.status_code == 200
    assert history_response.json()["records"] == []


def test_monitoring_refresh_assesses_watchlist_and_updates_overview(monkeypatch, tmp_path) -> None:
    database_path = tmp_path / "firewatch-refresh.sqlite3"
    database_url = f"sqlite:///{database_path.as_posix()}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    repository = SqlitePredictionHistoryRepository(database_url=database_url)

    def _stub_assessment_response(location: dict[str, object], forecast_windows: list[str]) -> dict[str, object]:
        assert forecast_windows == ["now"]
        record_id = repository.save_record(
            source_state="live",
            location=location,
            requested_forecast_windows=forecast_windows,
            data_source_labels={"assessment": "live", "weather": "live-open-meteo", "narrative": "fallback"},
            forecast_assessments=[
                {
                    "forecast_window": "now",
                    "risk_level": "medium",
                    "risk_score": 0.52,
                    "priority_rank": "P3",
                }
            ],
            assessment_timestamp="2026-06-03T12:00:00Z",
        )
        return {
            "source_state": "live",
            "prediction_history_record_id": record_id,
            "forecast_assessments": [{"forecast_window": "now"}],
        }

    monkeypatch.setattr(monitoring_refresh, "build_assessment_response", _stub_assessment_response)

    response = TestClient(app).post("/api/monitoring/refresh")

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_state"] == "live"
    assert len(payload["refreshed"]) == 10
    assert payload["skipped"] == []
    assert payload["failed"] == []

    overview = TestClient(app).get("/api/monitoring/overview").json()
    assert len(overview["regional_summaries"]) == 10
    assert {summary["risk_level"] for summary in overview["regional_summaries"]} == {"medium"}


def test_monitoring_refresh_skips_fresh_watchlist_assessments(monkeypatch, tmp_path) -> None:
    database_path = tmp_path / "firewatch-refresh-fresh.sqlite3"
    database_url = f"sqlite:///{database_path.as_posix()}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    repository = SqlitePredictionHistoryRepository(database_url=database_url)
    for location in get_watch_locations():
        repository.save_record(
            source_state="live",
            location={
                "name": location["name"],
                "latitude": location["latitude"],
                "longitude": location["longitude"],
                "source": "system-watchlist",
            },
            requested_forecast_windows=["now"],
            data_source_labels={"assessment": "live", "weather": "live-open-meteo", "narrative": "fallback"},
            forecast_assessments=[
                {
                    "forecast_window": "now",
                    "risk_level": "low",
                    "risk_score": 0.2,
                    "priority_rank": "P4",
                }
            ],
            assessment_timestamp="2026-06-03T12:00:00Z",
        )

    def _unexpected_assessment_response(location: dict[str, object], forecast_windows: list[str]) -> dict[str, object]:
        raise AssertionError("fresh watchlist records should not be reassessed")

    monkeypatch.setattr(monitoring_refresh, "build_assessment_response", _unexpected_assessment_response)

    payload = monitoring_refresh.refresh_watchlist_assessments(
        now=datetime(2026, 6, 3, 12, 10, tzinfo=UTC),
    )

    assert payload["source_state"] == "live"
    assert payload["refreshed"] == []
    assert len(payload["skipped"]) == 10
    assert payload["failed"] == []
