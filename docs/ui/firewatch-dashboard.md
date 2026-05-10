# FIREWATCH DSS Dashboard UI

FIREWATCH DSS uses an Apple-inspired, map-first operational dashboard adapted for wildfire risk management in Turkiye.

The dashboard should feel calm, polished, modern, and practical for forest officers and disaster management officials. It should use neutral surfaces, rounded controls, restrained color, and first-class light and dark themes. It must not use military, intelligence, fictional command-center, or alarmist emergency language.

## Design Intent

The interface answers four operational questions:

- Where is wildfire risk highest right now?
- Why is that area risky?
- What action should officials take?
- Which areas should be prioritized first?

The main screen is a satellite-style geospatial monitoring workspace centered on Turkiye. The layout may use operational dashboard structure, map overlays, side rails, and a bottom timeline, but the visual language should feel closer to Apple Maps, Apple Weather, and modern macOS/iOS utility surfaces than to a noisy command center. The semantics must remain wildfire decision support.

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

- OpenWeather status.
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

### Top Status Header

The top bar should be compact, calm, and operational. It should feel like a native app toolbar rather than a website header.

It contains:

- `FIREWATCH DSS`
- Search input.
- Selected region or coordinates.
- Weather API status.
- Model status.
- Last updated time.
- User role, such as `Forest Officer` or `Disaster Management`.

Avoid oversized branding, marketing copy, hero-style presentation, heavy color blocks, or decorative dashboard chrome. This is a tool surface.

The user role control is a demo selector for presentation emphasis only.

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

The sidebar should use rounded, softly separated groups rather than harsh panel blocks. Layer state should be clear from toggles, icons, opacity, and concise labels, not from large colored backgrounds.

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

The right panel is the main decision-support surface. It should use strong typographic hierarchy, generous spacing, rounded modules, and minimal color. Risk color is allowed for the current Risk Level, but the whole panel should not become red, orange, or yellow.

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

MVP recommendation rules:

- Low: routine monitoring, 5 km monitoring radius, no alert.
- Medium: increase weather review, 10 km monitoring radius, no alert.
- High: prioritize local inspection, 20 km monitoring radius, active alert expires in 24h.
- Critical: immediate supervisor review, 30 km monitoring radius, active alert expires in 12h.

These are advisory decision-support suggestions, not dispatch orders or emergency instructions.

Weather signals may include display-only context that was not used by the model. The panel must distinguish model-input drivers from other observed or forecast weather context.

### Bottom Strip: Alerts And Regional Timeline

The bottom strip combines alert review and regional quick access.

The bottom strip should feel like a compact native app shelf. It should be horizontally scannable, softly elevated from the map, and calm even when high or critical risk items are present.

It contains:

- Recent active risk alerts.
- Forecast markers: now, 24h, 48h, 72h.
- Quick access for Turkish regions.
- Compact risk indicators per region.
- Optional sparkline for risk trend.

Active alerts are system-generated high or critical risk alerts. They are not confirmed fires or official government emergency alerts.

Demo overview hotspots may look high or critical, but they do not create persistent active risk alerts.

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

If OpenWeather is unavailable, the UI must not present a new live risk assessment. A cached assessment view may be shown only when matching cached weather exists for the selected location and forecast window, and it must show the original weather timestamp with a visible `Cached` label. If no matching cache exists, the UI shows degraded weather status and no assessment result.

Live OpenWeather-backed assessment is part of the selected-location search flow, not the default national overview.

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

For the MVP, the national overview uses curated monitoring locations with demo monitoring data when full live national coverage is not implemented. It must be labeled compactly as demo or simulated overview data, while searched or selected locations use live OpenWeather-backed assessment when available.

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

## Visual Language

Use:

- Apple-inspired operational surfaces.
- First-class light and dark themes.
- Neutral color foundations: white, off-white, graphite, charcoal, and soft grays.
- One restrained accent color for selection and focus.
- Rounded panels, controls, search fields, popovers, and map overlays.
- Soft borders, subtle shadows, and translucent or blurred surfaces where they improve depth.
- System font stacks and native-app spacing rhythm.
- Sparse, meaningful risk color.
- Readable panels with enough density for operational work.
- Compact status labels.
- Map-first composition.
- Clear hierarchy between map, sidebars, and bottom timeline.
- Serious wildfire-management terminology.

Avoid:

- Noisy multi-color dashboard styling.
- Large red, orange, or yellow surfaces as default wildfire branding.
- Heavy borders, hard black panels, and harsh high-contrast chrome.
- Decorative gradients, sci-fi effects, and command-center styling.
- One-note color palettes.
- Marketing landing-page structure.
- Oversized hero sections.
- Military or intelligence labels.
- Fictional command language.
- Alarmist emergency phrasing.

Theme requirements:

- The MVP must support both light and dark themes.
- The theme control should be visible in the dashboard chrome and feel like a native setting.
- Light theme should use soft white or mist gray surfaces, subtle separators, and dark neutral text.
- Dark theme should use graphite or near-black surfaces, muted borders, and light neutral text.
- Both themes must preserve the same layout, information hierarchy, and interaction behavior.

Risk color requirements:

- Low: muted green.
- Medium: soft amber.
- High: warm orange.
- Critical: controlled red.
- Risk color should appear in badges, markers, rings, small charts, or status accents.
- Risk color must not dominate the whole page.

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
- The system stores one grouped prediction history record with per-window results.

Advanced geospatial layers, 3D globe mode, SHAP explanations, prediction-outcome tuning UI, response-station routing, and richer operational datasets are phase-two enhancements.

## Screenshot Inspiration Boundary

Previous Sentinel-style references are now superseded as the primary visual direction. FIREWATCH DSS may still borrow map-first layout grammar, side rails, compact search overlay behavior, telemetry density, and bottom strip structure when useful.

FIREWATCH DSS must not borrow Sentinel's military, intelligence, or security semantics.

The primary visual reference is now an Apple-inspired operational UI: calm neutral surfaces, rounded native-app controls, restrained color, and polished light/dark themes.
