# FIREWATCH DSS

Weather-driven wildfire risk decision support dashboard for Turkish locations.

## Project Structure

- `frontend/`: React, TypeScript, Vite dashboard.
- `backend/`: FastAPI backend, integrations, assessment orchestration, persistence.
- `ml/`: model training, selected model artifacts, notebooks, and metrics.
- `data/`: raw, processed, demo, and curated location data.
- `docs/`: product, UI, architecture, and ADR documentation.
- `scripts/`: project helper scripts.

## Environment Configuration

Copy `.env.example` to `.env` in the repository root and set:

- `MAPBOX_ACCESS_TOKEN`
- `OPENWEATHER_API_KEY`
- `GROQ_API_KEY`
- `MODEL_ARTIFACT_PATH`
- `DATABASE_URL`

The backend loads `.env` automatically and exposes only safe configuration
state through `GET /api/status`.

## Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The frontend dev server proxies `/api/*` to `http://127.0.0.1:8000`,
so keep the backend running on port `8000` during local dashboard work.

Backend status surfaces:

- `GET /health`
- `GET /api/status`

Run backend smoke tests:

```bash
cd backend
pytest -q
```

## Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Run frontend smoke tests:

```bash
cd frontend
npm test -- --run
```
