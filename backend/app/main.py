"""FastAPI entry point for FIREWATCH DSS."""

from fastapi import FastAPI

from app.core.config import build_status_payload

app = FastAPI(title="FIREWATCH DSS API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/status")
def api_status() -> dict[str, object]:
    return build_status_payload()
