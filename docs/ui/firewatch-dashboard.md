# FIREWATCH DSS Dashboard UI

> [!WARNING]
> **Layout and visual language superseded.** The layout structure (left sidebar, right sidebar, bottom strip) and Apple-inspired visual direction in this document are replaced by the Sentinel-Inspired Operational Interface validated in `prototype.html`. See:
> - [Phase Two Frontend Direction](phase-two-frontend-direction.md) for the selected design direction
> - [Frontend Implementation PRD](../prd/frontend-implementation-prd.md) for the rebuild plan
> - [ADR-0002](../adr/0002-sentinel-inspired-frontend-direction.md) for the decision record
>
> **Still valid**: data honesty rules, terminology, search behavior, Groq narrative constraints, risk color semantics, MVP scope, and recommendation rule table.

FIREWATCH DSS uses a Sentinel-inspired, map-first operational dashboard adapted for wildfire risk management in Turkiye.

The dashboard should feel operational, readable, and practical for forest officers and disaster management officials. It must not use military, intelligence, fictional command-center, or alarmist emergency language.

## Design Intent

The interface answers four operational questions:

- Where is wildfire risk highest right now?
- Why is that area risky?
- What action should officials take?
- Which areas should be prioritized first?

The main screen is a satellite-style geospatial monitoring workspace centered on Turkiye. The layout uses a full-screen Mapbox canvas with floating panels that unfold through interaction. The semantics must remain wildfire decision support.

## Primary Users

**Forest Officer**:
The primary user. The UI should support local inspection, preventive monitoring, patrol prioritization, and review of weather-driven risk.

**Disaster Management Official**:
The secondary user. The UI should support regional prioritization, alert review, and coordination awareness.

MVP role handling is a non-authenticated demo role selection. It may adjust wording, ordering, and visual emphasis, but it must not imply accounts, secure permissions, or role-based access control.

## Main Screens

### Monitoring Dashboard

The primary workspace for live and demo monitoring.

Required MVP elements:

- Mapbox GL JS satellite-style map centered on Turkiye.
- Search for Turkish provinces, districts, cities, or coordinates.
- Predicted risk hotspots.
- Heat-zone style visualization for elevated-risk clusters where available.
- Left data-layer sidebar.
- Right decision support panel.
- Bottom alert timeline and regional quick-access strip.
- Compact top status header.
- Source labels for live, demo, cached, unavailable, estimated, and fallback data.

### Prediction History

Shows previous model assessments and recommendations.

Required MVP elements:

- Prediction history records grouped by assessment request.
- Per-window result rows for now, 24h, 48h, and 72h where requested.
- Filters by region, date, and risk level.
- Stored weather inputs, risk score, risk level, recommendation, and alert status.
- Clear distinction from confirmed wildfire incident history.

Phase-two elements:

- Prediction outcome comparison.
- Reviewed outcome entries.
- Offline model tuning dataset support.
- Evaluation metrics such as true positives, false positives, and false negatives.

### Model And Data Status

Explains the system's model and data state.

Required MVP elements:

- Weather API Source status.
- Mapbox status.
- Groq narrative provider status.
- Model version and status.
- Dataset source.
- Last model training date, if available.
- Runtime feature schema summary.
- Runtime feature unit schema.
- Candidate models tested.
- Selected model algorithm.
- Validation metrics and confusion matrix.
- Operational Risk Threshold version.
- Clear note that the Morocco wildfire dataset is used as a proxy training dataset.
- Clear note that Turkiye-specific historical wildfire data is future validation work.
- Clear note that FIREWATCH DSS demonstrates prototype relative wildfire risk, not validated operational accuracy for Turkiye.

## Layout

> [!IMPORTANT]
> **Layout superseded by Sentinel-inspired dashboard design.**
> The three-column sidebar layout has been replaced by the layout described in [Phase Two Frontend Direction](phase-two-frontend-direction.md) and [Frontend Implementation PRD](../prd/frontend-implementation-prd.md), which is based on the validated [prototype.html](../../prototype.html).


## Search Behavior

Search is the main investigation tool.

MVP search should use a curated Turkish location index for reliable demo behavior. Direct coordinate search should also be supported. Mapbox geocoding may be added as broader optional support.

When a user searches:

- The user enters a province, district, city, or coordinate.
- The system resolves a location search result.
- The map zooms smoothly to the selected location.
- FIREWATCH fetches current or forecast weather from the Weather API Source.
- The model produces a wildfire risk score.
- The system maps the risk score into a risk level.
- The recommendation rule table selects an approved recommended action.
- The decision support panel updates.
- Groq may generate concise operational briefing text from the structured assessment payload.

If the Weather API Source is unavailable, the UI must not present a new live risk assessment. A cached assessment view may be shown only when matching cached weather exists for the selected location and forecast window, and it must show the original weather timestamp with a visible `Cached` label. If no matching cache exists, the UI shows degraded weather status and no assessment result.

Live Weather API-backed assessment is part of the selected-location search flow, not the default national overview.

## Default Dashboard State

When no specific location is selected, the dashboard shows a Turkiye national monitoring overview.

It includes:

- Map centered on Turkiye.
- Major predicted risk hotspots.
- Elevated-risk heat zones where available.
- Active data layers.
- National risk summary.
- Count of high and critical hotspots.
- Top priority regions.
- National weather signals where available.
- National-level recommended action.

For the MVP, the national overview uses curated monitoring locations with demo monitoring data when full live national coverage is not implemented. It must be labeled compactly as demo or simulated overview data, while searched or selected locations use live Weather API-backed assessment when available.

## Data Source Labels

Every major data element should reveal its provenance in a compact operational style.

Recommended labels:

- `Live`: current external data from the Weather API Source for a selected location.
- `Demo`: simulated or preloaded data used for prototype overview.
- `Estimated`: model-derived score or classification.
- `Cached`: previously fetched data reused during degraded status.
- `Unavailable`: configured layer or integration is not available.
- `Fallback`: deterministic template used because Groq or another provider is unavailable.

Examples:

- `Weather Signals: Live Open-Meteo`
- `Predicted Hotspots: Demo Overview`
- `Risk Level: Estimated`
- `Narrative: Groq`
- `Narrative: Template Fallback`
- `Assessment: Cached, weather 2026-05-08 12:00 UTC`

## Groq Narrative Layer

Groq is part of the MVP as a narrative provider only.

The LLM may:

- Generate concise operational briefing text.
- Rephrase structured risk assessment facts.
- Explain the approved recommended action in plain language.

The LLM must not:

- Predict the risk level.
- Change the risk score.
- Invent weather factors.
- Create new recommendations outside the recommendation rule table.
- Claim official emergency authority.

Groq receives only a structured assessment payload, not raw app state.

If Groq is unavailable or rate-limited, the UI uses deterministic template briefing text.

## Model Explanation

MVP explanation should show weather signals and simple risk drivers without implying every displayed signal was used by the model.

Recommended labels:

- `Weather Signals`
- `Temperature: elevated`
- `Wind: strong`
- `Rainfall: none`
- `Context: humidity low`
- `Model input drivers: heat + wind + low rainfall`

SHAP-style model explanation is phase two unless the core workflow is already solid. If SHAP is added, it must be labeled as model behavior explanation, not real-world wildfire causality.

## Visual Language and Terminology

> [!IMPORTANT]
> **Visual language superseded by Sentinel-inspired design.**
> The visual rules (rounded surfaces, system fonts, Apple aesthetics) are replaced by the Sentinel-inspired design system. See [Phase Two Frontend Direction](phase-two-frontend-direction.md) and [Frontend Implementation PRD](../prd/frontend-implementation-prd.md).

### Terminology Guidelines
Use terms such as:

- `Fire Risk Assessment`
- `Weather Signals`
- `Active Risk Alerts`
- `Recommended Action`
- `Region Priority`
- `Model Status`
- `Data Layers`
- `Monitoring Radius`

Avoid terms such as:

- `Threat Assessment`
- `SIGINT`
- `Target`
- `Top Secret`
- `Mission Control`
- `Enemy`
- `Active Fire`, unless a confirmed fire source is explicitly implemented.

## MVP Scope

The MVP should prove the end-to-end risk assessment workflow:

- User opens the dashboard.
- User searches a Turkish location.
- Map zooms to the result.
- The Weather API Source provides current and forecast weather.
- The trained model generates a risk score and risk level.
- The recommendation rule table selects an approved action.
- Groq generates grounded operational briefing text or a template fallback is used.
- The system stores one grouped prediction history record with per-window results.

Advanced geospatial layers, 3D globe mode, SHAP explanations, prediction-outcome tuning UI, response-station routing, and richer operational datasets are phase-two enhancements.

## Visual Reference Boundary

The primary visual and interactive reference for implementation is [prototype.html](../../prototype.html) (root directory), which reflects the selected Sentinel-Inspired Operational Interface. Do not use any previous mockups, screenshots, or Apple-inspired descriptions for the user interface.
