"""FastAPI entry point for FIREWATCH DSS."""

from fastapi import FastAPI

from app.core.config import build_status_payload
from app.services.locations.search import search_locations

app = FastAPI(title="FIREWATCH DSS API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/status")
def api_status() -> dict[str, object]:
    return build_status_payload()


@app.get("/api/locations/search")
def location_search(q: str) -> dict[str, object]:
    results = [result.__dict__ for result in search_locations(q)]
    return {
        "query": q,
        "results": results,
        "message": None if results else "No location search results found.",
    }
