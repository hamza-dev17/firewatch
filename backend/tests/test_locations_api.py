from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import app


def test_location_search_returns_curated_turkish_match() -> None:
    client = TestClient(app)

    response = client.get("/api/locations/search", params={"q": "Ankara"})

    assert response.status_code == 200
    payload = response.json()

    assert payload["query"] == "Ankara"
    assert len(payload["results"]) == 1

    first = payload["results"][0]
    assert first["display_name"] == "Ankara, Turkiye"
    assert first["latitude"] == 39.9334
    assert first["longitude"] == 32.8597
    assert first["admin"] == {
        "province": "Ankara",
        "district": "Cankaya",
        "country": "Turkiye",
    }
    assert first["source_label"] == "curated-index"


def test_location_search_includes_istanbul_and_gaziantep() -> None:
    client = TestClient(app)

    istanbul_response = client.get("/api/locations/search", params={"q": "Istanbul"})
    gaziantep_response = client.get("/api/locations/search", params={"q": "Gaziantep"})

    assert istanbul_response.status_code == 200
    assert gaziantep_response.status_code == 200

    istanbul_results = istanbul_response.json()["results"]
    gaziantep_results = gaziantep_response.json()["results"]

    assert any(item["display_name"] == "Istanbul, Turkiye" for item in istanbul_results)
    assert any(item["display_name"] == "Gaziantep, Turkiye" for item in gaziantep_results)


def test_location_search_accepts_direct_coordinates() -> None:
    client = TestClient(app)

    response = client.get("/api/locations/search", params={"q": "39.9334, 32.8597"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["query"] == "39.9334, 32.8597"
    assert len(payload["results"]) == 1

    first = payload["results"][0]
    assert first["display_name"] == "39.9334, 32.8597"
    assert first["latitude"] == 39.9334
    assert first["longitude"] == 32.8597
    assert first["admin"] == {
        "province": "",
        "district": "",
        "country": "Turkiye",
    }
    assert first["source_label"] == "direct-coordinates"


def test_location_search_returns_clear_empty_state_for_unresolved_text() -> None:
    client = TestClient(app)

    response = client.get("/api/locations/search", params={"q": "not-a-real-place"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["query"] == "not-a-real-place"
    assert payload["results"] == []
    assert payload["message"] == "No location search results found."
