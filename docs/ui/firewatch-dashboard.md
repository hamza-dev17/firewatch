# FIREWATCH DSS Dashboard UI

FIREWATCH DSS uses a dark, map-first operational dashboard inspired by Sentinel-style geospatial monitoring interfaces, adapted for wildfire risk management in Turkiye.

The dashboard should feel serious, fast, and practical for forest officers and disaster management officials. It must not use military, intelligence, or fictional command-center language.

## Design Intent

The interface answers four operational questions:

- Where is wildfire risk highest right now?
- Why is that area risky?
- What action should officials take?
- Which areas should be prioritized first?

The main screen is a satellite-style geospatial monitoring workspace centered on Turkiye. The layout may borrow Sentinel-style density, dark panels, compact telemetry, map overlays, side rails, and a bottom timeline, but the semantics must remain wildfire decision support.

## Primary Users

**Forest Officer**:
The primary user. The UI should support local inspection, preventive monitoring, patrol prioritization, and review of weather-driven risk.

**Disaster Management Official**:
The secondary user. The UI should support regional prioritization, alert review, and coordination awareness.

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

- Prediction history records.
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

- OpenWeather status.
- Mapbox status.
- Groq narrative provider status.
- Model version and status.
- Dataset source.
- Last model training date, if available.
- Clear note that the Morocco wildfire dataset is used as a proxy training dataset.
- Clear note that Turkiye-specific historical wildfire data is future validation work.

## Layout

### Top Status Header

The top bar should be compact and operational.

It contains:

- `FIREWATCH DSS`
- Search input.
- Selected region or coordinates.
- Weather API status.
- Model status.
- Last updated time.
- User role, such as `Forest Officer` or `Disaster Management`.

Avoid oversized branding, marketing copy, or hero-style presentation. This is a tool surface.

### Center Map Workspace

The map is the main workspace.

MVP behavior:

- Opens centered on Turkiye.
- Uses Mapbox GL JS with satellite-style map imagery.
- Supports zoom and pan.
- Supports search-based navigation.
- Shows predicted risk hotspots.
- Shows heat zones when available.
- Shows faint province or region boundaries when available.
- Allows clicking hotspots or selecting locations.
- Updates the decision support panel after selection.

The MVP map is an interactive 2D satellite-style map. A 3D globe mode is optional future work unless the core workflow is completed early.

### Left Sidebar: Data Layers

The left sidebar controls prediction and context layers.

Potential layers:

- Temperature
- Humidity
- Wind speed and direction
- Rainfall
- Drought index
- Predicted hotspots
- Heat zones
- Historical fire areas
- Vegetation dryness
- Province boundaries
- Forest regions
- Response stations
- Water sources or reservoirs

Each layer should show:

- Active or inactive state.
- Data source label.
- Last updated time where available.
- Unavailable or demo status where appropriate.

Not every displayed layer is a model input. The UI must distinguish prediction inputs from context layers.

### Right Sidebar: Decision Support Panel

The right panel changes based on the selected hotspot, province, or manually selected location.

Required MVP fields:

- Location name or coordinates.
- Risk level: low, medium, high, or critical.
- Risk score.
- Model confidence, if available.
- Forecast trend: rising, stable, or decreasing.
- Weather signals.
- Recommended action.
- Priority rank.
- Monitoring radius.
- Data source labels.
- Groq-generated operational briefing text or template fallback.

Avoid `Estimated Affected Radius`. Use `Monitoring Radius` because FIREWATCH DSS does not model fire spread, burn area, evacuation radius, or damage footprint.

### Bottom Strip: Alerts And Regional Timeline

The bottom strip combines alert review and regional quick access.

It contains:

- Recent active risk alerts.
- Forecast markers: now, 24h, 48h, 72h.
- Quick access for Turkish regions.
- Compact risk indicators per region.
- Optional sparkline for risk trend.

Active alerts are system-generated high or critical risk alerts. They are not confirmed fires or official government emergency alerts.

## Search Behavior

Search is the main investigation tool.

MVP search should use a curated Turkish location index for reliable demo behavior. Direct coordinate search should also be supported. Mapbox geocoding may be added as broader optional support.

When a user searches:

- The user enters a province, district, city, or coordinate.
- The system resolves a location search result.
- The map zooms smoothly to the selected location.
- FIREWATCH fetches current or forecast weather from OpenWeather.
- The model produces a wildfire risk score.
- The system maps the risk score into a risk level.
- The recommendation rule table selects an approved recommended action.
- The decision support panel updates.
- Groq may generate concise operational briefing text from the structured assessment payload.

If OpenWeather is unavailable, the UI must not present a new unlabelled live risk assessment. Cached or demo data may be shown only with a visible source label.

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

The national overview may use demo monitoring data when full live national coverage is not implemented. It must be labeled compactly as demo or simulated overview data.

## Data Source Labels

Every major data element should reveal its provenance in a compact operational style.

Recommended labels:

- `Live`: current external data, such as OpenWeather for a selected location.
- `Demo`: simulated or preloaded data used for prototype overview.
- `Estimated`: model-derived score or classification.
- `Cached`: previously fetched data reused during degraded status.
- `Unavailable`: configured layer or integration is not available.
- `Fallback`: deterministic template used because Groq or another provider is unavailable.

Examples:

- `Weather Signals: Live OpenWeather`
- `Predicted Hotspots: Demo Overview`
- `Risk Level: Estimated`
- `Narrative: Groq`
- `Narrative: Template Fallback`

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

MVP explanation should show weather signals and simple risk drivers.

Recommended labels:

- `Weather Signals`
- `Temperature: elevated`
- `Humidity: low`
- `Wind: strong`
- `Rainfall: none`
- `Primary drivers: heat + low humidity + wind`

SHAP-style model explanation is phase two unless the core workflow is already solid. If SHAP is added, it must be labeled as model behavior explanation, not real-world wildfire causality.

## Visual Language

Use:

- Dark operational surfaces.
- Dense but readable panels.
- Compact status labels.
- High-contrast risk colors.
- Map-first composition.
- Clear hierarchy between map, sidebars, and bottom timeline.
- Serious wildfire-management terminology.

Avoid:

- Marketing landing-page structure.
- Oversized hero sections.
- Decorative sci-fi styling.
- Military or intelligence labels.
- Fictional command language.
- Alarmist emergency phrasing.

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
- OpenWeather provides current and forecast weather.
- The trained model generates a risk score and risk level.
- The recommendation rule table selects an approved action.
- Groq generates grounded operational briefing text or a template fallback is used.
- The system stores a prediction history record.

Advanced geospatial layers, 3D globe mode, SHAP explanations, prediction-outcome tuning UI, response-station routing, and richer operational datasets are phase-two enhancements.

## Screenshot Inspiration Boundary

The provided Sentinel screenshots are visual and interaction references only. FIREWATCH DSS should borrow the dark map-first layout grammar, side rails, compact search overlay, telemetry density, and bottom strip pattern.

FIREWATCH DSS must not borrow Sentinel's military, intelligence, or security semantics.
