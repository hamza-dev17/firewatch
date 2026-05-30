# FIREWATCH DSS PRD

Status: approved MVP baseline for implementation issue breakdown

This PRD describes the MVP for FIREWATCH DSS: a weather-driven wildfire risk prediction and decision support dashboard for Turkish forest monitoring. It uses the project glossary vocabulary and is ready to be broken into implementation issues.

## Accepted Product Decisions

These decisions define the implementation-ready MVP scope.

| Product Decision | Accepted Direction |
| --- | --- |
| MVP scope | The searched-location risk assessment flow is the MVP spine. National overview, alerts, history, and model status stay thin enough to support that spine. |
| MVP success path | Search a Turkish location, fetch OpenWeather current and forecast weather, normalize runtime features, produce Risk Score and Risk Level, select Recommended Action and Monitoring Radius, generate briefing text or fallback, store one grouped Prediction History Record, and render the result on the dashboard. |
| National overview | Use curated Monitoring Locations with clearly labeled Demo Monitoring Data unless scheduled live monitoring is deliberately added later. |
| Demo overview alerts | Demo national overview hotspots must not create Active Risk Alerts. Persistent Risk Alerts are created only from high or critical live selected-location assessments. |
| Prediction History | MVP history is a basic grouped record list with per-window results and simple filters. Outcome comparison and tuning belong to phase two. |
| Reviewed outcome foundations | Phase-two Reviewed Outcome Entries and Prediction Outcome Comparisons follow `docs/architecture/reviewed-outcome-foundations.md`; they remain separate from predictions and live self-learning. |
| Model And Data Status | Include an informational status screen showing model evidence, data source status, feature schema, validation metrics, threshold version, and Transfer Limitation. Do not include tuning controls in MVP. |
| Groq dependency | Groq is a narrative provider only. A deterministic template fallback must satisfy the assessment workflow when Groq is unavailable. |
| Model explanation | SHAP-style explanations are phase two unless the core workflow finishes early. MVP shows Weather Signals and simple model-input drivers without claiming causal proof. |
| Role handling | Use Demo Role Selection only. Authentication, authorization, accounts, and role-based access control are phase two. |
| Model feature scope | The deployed model uses only Runtime Features that can be generated for Turkish locations at assessment time. Training-Only Features are excluded from the deployed predictor. |
| Accuracy claims | FIREWATCH DSS describes Prototype Relative Wildfire Risk and clearly presents the Morocco Proxy Training Dataset and Transfer Limitation. It does not claim official Turkiye wildfire accuracy. |
| Advanced operational layers | Response stations, water sources, historical fire areas, vegetation dryness, richer heat zones, and routing are phase two unless reliable sources are already available and the core workflow is complete. |

## MVP Scope Decision

The MVP spine is the selected-location **On-Demand Assessment** workflow:

1. User searches or selects a Turkish location.
2. FIREWATCH DSS resolves a **Location Search Result**.
3. The backend fetches current and forecast weather from the **OpenWeather Source**.
4. The backend normalizes weather into the deployed runtime feature schema.
5. The model produces a **Risk Score** and optional **Model Confidence**.
6. **Operational Risk Thresholds** assign one **Risk Level** per requested **Forecast Window**.
7. The **Recommendation Rule Table** selects the approved **Recommended Action**, **Monitoring Radius**, and alert expiry behavior.
8. The **LLM Advisory Layer** generates grounded **Operational Briefing Text**, or a deterministic template fallback is used.
9. The system stores one grouped **Prediction History Record** with one result per requested **Forecast Window**.
10. The dashboard updates the map, decision support panel, alert strip, data source labels, and history.

MVP-supporting surfaces should be intentionally thin:

- The national monitoring overview may use clearly labeled **Demo Monitoring Data**.
- Active alerts are created only from live selected-location high or critical assessments.
- Prediction history is a grouped assessment log, not an incident-history or evaluation workspace.
- Model and data status explains system evidence and limitations, not tuning controls.
- Data layers distinguish **Prediction Inputs** from **Context Layers**, even when both are visible.

Phase-two scope includes SHAP explanations, Reviewed Outcome Entries, Prediction Outcome Comparisons, Model Tuning Datasets, richer operational layers, response-station routing, real authentication, PostgreSQL migration, and 3D globe mode.
The approved foundation policy for Reviewed Outcome Entries, Outcome Matching Windows, and Prediction Outcome Comparisons is documented in `docs/architecture/reviewed-outcome-foundations.md`.

## Problem Statement

Forest officers and government disaster management officials need a practical way to monitor short-term wildfire risk across Turkish locations, understand the weather signals behind elevated risk, and decide where preventive attention should go first.

Current public data availability limits the ability to train an operationally validated Turkiye-specific wildfire model. The project therefore needs to demonstrate a credible decision-support workflow while being honest about proxy training data, model limitations, simulated national overview data, and non-operational accuracy.

## Solution

FIREWATCH DSS provides a Sentinel-inspired, map-first operational dashboard centered on Turkiye with a neutral instrumentation palette and polished light and dark themes. The MVP proves one selected-location assessment workflow: a user searches for a province, district, city, or coordinates; the system fetches current and forecast weather from OpenWeather; a trained ML model produces a Risk Score; Operational Risk Thresholds map that score into low, medium, high, or critical Risk Levels; a Recommendation Rule Table selects an approved Recommended Action and Monitoring Radius; and Groq generates concise Operational Briefing Text from a structured Assessment Payload, with a deterministic template fallback.

The dashboard also shows a Turkiye national monitoring overview, Active Risk Alerts, Data Source Labels, model/data status, and Prediction History Records. These supporting surfaces should remain thin in the MVP. National overview data may use Demo Monitoring Data when full live monitoring coverage is not implemented, and the UI must label it clearly.

FIREWATCH DSS is a prototype decision support system. It estimates Relative Wildfire Risk from weather-driven inputs. It does not detect active fires, process satellite imagery, automate emergency dispatch, or claim operationally validated accuracy across Turkiye.

## User Stories

1. As a Forest Officer, I want to open a Turkiye-centered monitoring dashboard, so that I can immediately see wildfire risk context for my country.
2. As a Forest Officer, I want the map to use satellite-style imagery, so that the dashboard feels geographically grounded and operational.
3. As a Forest Officer, I want to search for a province, district, city, or coordinates, so that I can inspect a specific location.
4. As a Forest Officer, I want search to work reliably for Turkish locations, so that demos and field workflows are not blocked by external geocoding issues.
5. As a Forest Officer, I want the map to zoom to the selected location, so that I can visually inspect the area being assessed.
6. As a Forest Officer, I want FIREWATCH DSS to fetch live weather for the selected location, so that the assessment reflects current conditions.
7. As a Forest Officer, I want FIREWATCH DSS to fetch forecast weather for now, 24h, 48h, and 72h, so that I can see whether risk is rising, stable, or decreasing.
8. As a Forest Officer, I want the system to generate a Wildfire Risk Assessment, so that I can understand current wildfire-favorable conditions.
9. As a Forest Officer, I want to see a Risk Level of low, medium, high, or critical, so that I can quickly interpret the assessment.
10. As a Forest Officer, I want to see a Risk Score, so that I can understand the model output behind the displayed category.
11. As a Forest Officer, I want Model Confidence to be displayed only when available, so that I can understand how strongly the model selected the Risk Level.
12. As a Forest Officer, I want Model Confidence to be clearly distinguished from real-world fire probability, so that I do not misinterpret it as operational certainty.
13. As a Forest Officer, I want to see Weather Signals such as temperature, humidity, wind, and rainfall, so that I can understand why the area is risky.
14. As a Forest Officer, I want simple risk drivers to be displayed, so that I can understand the main contributors without needing ML expertise.
15. As a Forest Officer, I want a Recommended Action tied to the Risk Level, so that I know the suggested preventive response.
16. As a Forest Officer, I want recommendations to be advisory, so that they support local procedures without replacing official emergency protocols.
17. As a Forest Officer, I want a calm operational briefing generated from the assessment facts, so that I can read a concise summary of the situation.
18. As a Forest Officer, I want the narrative briefing to use only approved assessment facts, so that it does not invent causes, risks, or instructions.
19. As a Forest Officer, I want a template fallback if Groq is unavailable, so that briefing text still appears during degraded service.
20. As a Forest Officer, I want to see Data Source Labels, so that I know whether data is live, demo, cached, estimated, unavailable, or fallback.
21. As a Forest Officer, I want the dashboard to block unlabelled live assessments when OpenWeather fails, so that stale or missing weather is not presented as live.
22. As a Forest Officer, I want to see clearly labeled Predicted Risk Hotspots on the national overview, so that I can identify demo monitoring locations needing attention without mistaking them for continuous live national coverage.
23. As a Forest Officer, I want national overview hotspots to be labeled when they are demo data, so that I do not confuse them with verified live coverage.
24. As a Forest Officer, I want Active Risk Alerts for high and critical live selected-location assessments, so that I can review current elevated-risk areas.
25. As a Forest Officer, I want Active Risk Alerts to be system-generated risk alerts, so that I do not mistake them for confirmed fires or official emergency alerts.
26. As a Forest Officer, I want a Priority Rank for assessed locations, so that I can sort attention between multiple risk areas.
27. As a Forest Officer, I want Priority Rank to be derived transparently, so that I understand why an area is prioritized.
28. As a Forest Officer, I want a Monitoring Radius, so that I can inspect nearby context without assuming a predicted burn area.
29. As a Forest Officer, I want layer toggles for weather and context layers, so that I can choose which map information to view.
30. As a Forest Officer, I want data layers to distinguish Prediction Inputs from Context Layers, so that I understand what the model actually used.
31. As a Forest Officer, I want to review grouped Prediction History Records, so that I can see past assessment requests and their per-window results.
32. As a Forest Officer, I want basic prediction history filters by region, date, and Risk Level, so that I can find relevant past assessments without turning MVP history into a full analytics workspace.
33. As a Disaster Management Official, I want a national risk summary, so that I can understand broader regional risk distribution.
34. As a Disaster Management Official, I want top priority regions to be visible, so that I can focus coordination attention.
35. As a Disaster Management Official, I want model and data status to be visible, so that I can judge whether the system is operating normally.
36. As a Disaster Management Official, I want the Morocco Wildfire Dataset limitation documented, so that I understand the Transfer Limitation.
37. As a Disaster Management Official, I want the system to avoid claiming official Turkiye fire-danger classes, so that the prototype remains honest.
38. As a Disaster Management Official, I want role-appropriate wording, so that the interface feels official and practical rather than fictional or military.
39. As a user, I want light and dark theme choices, so that the dashboard can be used comfortably in different environments.
40. As a user, I want a calm Sentinel-inspired interface with a neutral instrumentation palette, so that wildfire risk information feels polished and readable rather than noisy.
41. As a project evaluator, I want the app to clearly separate live data from demo data, so that the prototype is credible.
42. As a project evaluator, I want the app to explain why a Morocco proxy dataset is used, so that the data limitation is transparent.
43. As a project evaluator, I want the app to show an end-to-end working risk assessment workflow, so that the project demonstrates integrated value.
44. As a developer, I want the backend to own Risk Level and Recommended Action decisions, so that the frontend cannot accidentally diverge from the model contract.
45. As a developer, I want the model to depend only on Runtime Features, so that deployed predictions can be generated for Turkish locations.
46. As a developer, I want external integrations to have fallbacks, so that the dashboard remains demonstrable during API failures.
47. As a developer, I want Prediction History Records to store model outputs and input metadata, so that future evaluation and tuning can be supported.
48. As a future evaluator, I want Reviewed Outcome Entries to be possible later, so that predictions can be compared with what happened.
49. As a future evaluator, I want an Outcome Matching Window, so that prediction-outcome comparisons use explicit spatial and temporal rules.
50. As a future developer, I want SHAP-style Model Explanation to be phase two, so that MVP effort stays focused on the working assessment flow.
51. As a future administrator, I want richer operational layers such as response stations and water sources, so that decision support can become more practical over time.
52. As a future product owner, I want phase-two features separated from MVP, so that delivery can be planned realistically.

## Implementation Decisions

- The MVP should be a single repository and single deployable application with internal boundaries for frontend, backend API, ML prediction, integration clients, persistence, and demo monitoring data.
- The repository should use top-level `frontend/`, `backend/`, `ml/`, `data/`, `docs/`, and `scripts/` folders so each MVP responsibility has a clear home.
- Backend domain types, API schemas, assessment orchestration, location resolution, weather normalization, prediction, classification, recommendations, narrative generation, alerts, history, monitoring overview, and status reporting should have separate folders to avoid mixing runtime decision logic with persistence or presentation code.
- The frontend should provide a Sentinel-Inspired Operational Interface using wildfire risk-management language, not military or intelligence terminology.
- The frontend should support both light and dark themes as first-class dashboard modes.
- The UI should use neutral surfaces, rounded native-app controls, restrained accent color, and risk colors only where they communicate risk state.
- The Mapbox Map Workspace should be implemented with Mapbox GL JS and centered on Turkiye.
- The MVP map should be interactive 2D satellite-style. 3D globe mode is future work unless the core workflow is completed early.
- Search should use a Curated Turkish Location Index for reliable MVP behavior, support direct coordinate input, and optionally use Mapbox geocoding.
- OpenWeather should be the MVP Weather API Source for Weather Observations and Weather Forecast Inputs.
- Backend services should fetch OpenWeather and Groq data so private API keys are not exposed to the browser.
- Mapbox access token handling should follow Mapbox's frontend token model and be restricted appropriately.
- External Service Keys must come from environment variables.
- Missing or failing external services must produce Integration Fallback behavior and visible Degraded Data Status.
- The deployed model must use only Runtime Features available for Turkish locations at prediction time.
- Training-Only Features from the Morocco Wildfire Dataset must not be required for runtime prediction unless reliable runtime sources are added.
- The ML module should return a Risk Score and optional Model Confidence.
- Operational Risk Thresholds should map Risk Score to low, medium, high, and critical Risk Levels.
- The Recommendation Rule Table should deterministically map Risk Level to approved Recommended Actions.
- Groq should be part of MVP only as the Groq Narrative Provider for Operational Briefing Text.
- Groq must receive an Assessment Payload, not raw app state.
- Groq must not predict Risk Level, change Risk Score, invent weather factors, create recommendations, or claim official emergency authority.
- A deterministic narrative template must be available when Groq is unavailable or rate-limited.
- The backend should create Prediction History Records for completed assessments.
- High and critical live selected-location Wildfire Risk Assessments should create Risk Alerts.
- Active Risk Alerts should be current system-generated high or critical Risk Alerts, not confirmed fires or official emergency alerts.
- Priority Rank should be derived mainly from Risk Level, Risk Score, Risk Trend, and data freshness in MVP.
- Monitoring Radius should be used instead of estimated affected radius.
- National overview hotspots and unavailable operational layers may use Demo Monitoring Data when clearly labeled, but demo overview data must not create persistent Risk Alerts.
- The UI must display compact Data Source Labels for live, demo, estimated, cached, unavailable, and fallback states.
- Prediction History Records are not confirmed wildfire incident records.
- Model and data status should explain the Morocco Wildfire Dataset, Proxy Training Dataset, and Transfer Limitation.
- Reviewed Outcome Entries, Prediction Outcome Comparisons, Outcome Matching Windows, and Model Tuning Datasets are phase-two unless deliberately pulled into MVP.
- Any phase-two outcome implementation must follow `docs/architecture/reviewed-outcome-foundations.md`, preserve Prediction History semantics, and keep comparisons as offline evaluation or tuning inputs.
- SHAP-style Model Explanation is phase two unless the core workflow is already solid.

## Major Modules

- Frontend dashboard
- Map workspace
- Search and location resolver
- Weather client
- Runtime feature normalizer
- ML prediction module
- Risk classification module
- Recommendation engine
- Narrative service
- Monitoring overview provider
- Alert service
- Prediction history repository
- Model and data status service
- Phase-two outcome comparison service, excluded from MVP implementation

## API Contract Direction

The backend should expose APIs for:

- system status
- location search
- risk assessment creation
- monitoring overview
- active alerts
- prediction history

Phase-two APIs may support:

- reviewed outcomes
- prediction-outcome comparisons
- model evaluation
- model tuning datasets

The assessment response should include:

- selected location
- Forecast Windows
- Weather Signals
- Risk Score
- Risk Level
- Model Confidence when available
- Risk Trend
- Priority Rank
- Monitoring Radius
- Recommended Action
- Narrative Explanation or template fallback
- Data Source Labels
- alert metadata if created

## Testing Decisions

Good tests should verify external behavior and domain rules, not internal implementation details.

Unit tests should cover:

- OpenWeather field normalization into Runtime Features.
- Risk Score to Risk Level threshold mapping.
- Recommendation Rule Table output.
- Priority Score and Priority Rank.
- Monitoring Radius mapping.
- Assessment Payload construction.
- Groq fallback template generation.
- Location search and coordinate parsing.
- Data Source Label assignment.

Integration tests should cover:

- Full assessment API flow with mocked OpenWeather, model, Groq, and persistence.
- OpenWeather degraded state.
- Groq fallback state.
- Model unavailable state.
- Prediction History Record creation.
- Risk Alert creation for high and critical live selected-location assessments.
- History filtering by region, date, and Risk Level.

Frontend tests should cover:

- Search result selection updates the map and decision support panel.
- Decision support panel displays Risk Level, Weather Signals, Recommended Action, and Data Source Labels.
- Layer toggles do not imply that every layer is a Prediction Input.
- Active Risk Alerts render as system-generated risk alerts.
- Model and data status screen displays proxy dataset limitation.

Model tests should cover:

- The deployed model artifact accepts the expected Runtime Feature schema.
- The training pipeline excludes unavailable Training-Only Features from the deployed predictor.
- The model prediction output shape remains stable.
- Evaluation metrics are reported against proxy validation data without claiming Turkiye operational accuracy.

## Out Of Scope

- Real-time fire detection.
- Confirmed active fire incident feeds.
- Satellite image processing.
- ESA Sentinel data processing.
- Drone monitoring.
- Physical sensor deployment.
- Fully automated emergency dispatch.
- Official government emergency alerting.
- Public citizen mobile application.
- Guaranteed operational accuracy across Turkiye.
- Official Turkiye fire-danger classification.
- Fire-spread simulation.
- Burn-area, damage-footprint, evacuation-radius, or affected-radius prediction.
- Automatic live model retraining.
- Full nationwide continuous live assessment of every coordinate.
- Military, intelligence, or fictional command-center semantics.
- 3D globe mode for MVP.
- SHAP explanation for MVP unless core workflow is already solid.
- Advanced response station, water source, vegetation dryness, and historical fire layers unless reliable sources are added.

## Issue Breakdown Readiness

This PRD is ready to become implementation issues. The issue breakdown should follow vertical slices around the MVP spine rather than separate UI-only or backend-only workstreams:

1. Project scaffold and configuration.
2. Runtime feature contract and Training-Only Feature exclusions.
3. Curated Turkish Location Index and coordinate parsing.
4. OpenWeather client and canonical weather normalization.
5. Runtime-compatible model training and model artifact evidence.
6. Prediction service, thresholds, and Recommendation Rule Table.
7. Assessment API with Groq/template narrative behavior.
8. Prediction history persistence with grouped per-window results.
9. Mapbox dashboard shell and selected-location search flow.
10. Decision support panel with Data Source Labels and briefing text.
11. Demo national overview with clearly labeled Monitoring Locations.
12. Active Risk Alerts from live selected-location high/critical assessments.
13. Model and data status evidence screen.
14. Basic prediction history screen.

## Further Notes

FIREWATCH DSS should be presented as a prototype decision support system that estimates Relative Wildfire Risk, not as an operational wildfire authority.

The strongest MVP demo is the end-to-end searched-location flow: search a Turkish location, fetch OpenWeather data, generate a model-based Wildfire Risk Assessment, show the decision panel, generate Groq briefing text, store history, and label data provenance clearly.

The national overview should look operational and useful, but it must not imply full live national coverage unless that coverage is actually implemented.

The Morocco Wildfire Dataset should be explained as a Proxy Training Dataset. Turkiye-specific historical wildfire data should be identified as future validation and calibration work.

The next step is to break the accepted MVP spine into implementation issues.
