# FIREWATCH DSS

FIREWATCH DSS predicts weather-driven wildfire risk for Turkish locations and presents the result as decision support for forest officers and disaster management officials.

## Language

**Wildfire Risk**:
The estimated short-term likelihood that local weather conditions are favorable for wildfire ignition or rapid spread.
_Avoid_: Active fire, detected fire, confirmed fire

**Relative Wildfire Risk**:
A comparison-oriented estimate used to prioritize monitoring between locations, not a validated absolute probability of wildfire occurrence.
_Avoid_: Operationally validated risk probability

**Wildfire Risk Assessment**:
A prediction result for a selected location and time window.
_Avoid_: Fire detection result, incident report

**Live Risk Assessment**:
A **Wildfire Risk Assessment** generated for a selected location using current or forecast weather data from a weather API.
_Avoid_: Simulated overview marker

**Forecast Window**:
A prediction time horizon such as now, 24h, 48h, or 72h.
_Avoid_: Fire-spread simulation step

**Weather API Source**:
The external service used at runtime to fetch current and forecast weather data for Turkish locations.
_Avoid_: Fire incident source, satellite detection source

**OpenWeather Source**:
The MVP **Weather API Source** used to fetch current and forecast weather data for selected Turkish locations.
_Avoid_: Fire incident feed, official wildfire registry

**Weather Observation**:
Current weather data fetched from the **Weather API Source** for a selected location.
_Avoid_: Forecast, training row

**Weather Forecast Input**:
Forecast weather data fetched from the **Weather API Source** for a selected location and **Forecast Window**.
_Avoid_: Fire-spread forecast

**Weather Signal**:
A weather factor shown to explain local conditions for a **Wildfire Risk Assessment**, whether or not it is a **Prediction Input**.
_Avoid_: Guaranteed model driver

**Cached Weather Data**:
Previously fetched weather data reused only when clearly labeled as cached.
_Avoid_: Live weather

**Cached Assessment View**:
A non-live display of a previously computed assessment or cached weather-backed assessment shown during **Degraded Data Status**.
_Avoid_: Live Risk Assessment, new live prediction

**Degraded Data Status**:
A system state where a required external data source is unavailable, stale, or failing.
_Avoid_: Normal live status

**Risk Trend**:
The direction of change across multiple **Wildfire Risk Assessments** for the same location over ordered **Forecast Windows**.
_Avoid_: Fire progression, spread forecast

**Prototype Risk Estimate**:
A non-operational **Wildfire Risk Assessment** produced to demonstrate the decision-support workflow.
_Avoid_: Official forecast, certified fire-danger rating

**Morocco Wildfire Dataset**:
The 2010-2022 source dataset used to train the prototype model, combining Moroccan wildfire occurrences with meteorological, environmental, population, temporal, and spatial features.
_Avoid_: Turkiye wildfire dataset, local fire registry

**Proxy Training Dataset**:
A non-Turkiye dataset used because limited public Turkiye-specific wildfire training data is available for this project.
_Avoid_: Official Turkiye calibration data

**Transfer Limitation**:
The uncertainty introduced by applying a model trained on Moroccan wildfire conditions to Turkish locations.
_Avoid_: Validated national accuracy

**Risk Score**:
The model output used to estimate how favorable the input conditions are for wildfire occurrence.
_Avoid_: Confirmed fire probability, official danger index

**Model Confidence**:
The model's internal confidence for the selected **Risk Level**.
_Avoid_: Validated real-world probability, official accuracy

**Model Explanation**:
An optional explanation of how the model's input features influenced the selected **Risk Level**.
_Avoid_: Real-world causality proof

**Narrative Explanation**:
A human-readable summary generated from structured **Wildfire Risk Assessment** facts.
_Avoid_: Risk prediction source, invented reasoning

**Operational Briefing Text**:
Calm, concise explanation text written for forest officers or disaster management officials.
_Avoid_: Alarmist warning, military narration, dramatic emergency language

**Assessment Payload**:
The structured facts from a **Wildfire Risk Assessment** passed to the **LLM Advisory Layer**.
_Avoid_: Raw application state, unconstrained prompt context

**LLM Advisory Layer**:
An optional language-model layer that turns approved risk assessment data into concise officer-facing explanation text.
_Avoid_: Primary classifier, source of truth

**Groq Narrative Provider**:
The MVP LLM provider used by the **LLM Advisory Layer** to generate officer-facing narrative explanations.
_Avoid_: Risk model, recommendation engine

**External Service Key**:
An environment-provided credential used to access Mapbox, OpenWeather, Groq, or another external integration.
_Avoid_: Hard-coded API key, committed secret

**Integration Fallback**:
A degraded behavior used when an external service key is missing or an external service is unavailable.
_Avoid_: Silent failure, fake live status

**Runtime Feature**:
A model input that FIREWATCH DSS can provide for a Turkish location when a prediction is requested.
_Avoid_: Training-only feature

**Prediction Input**:
A **Runtime Feature** passed into the model to produce a **Risk Score**.
_Avoid_: Display-only layer

**Context Layer**:
A geospatial or operational map layer shown to help users interpret risk but not necessarily used by the model.
_Avoid_: Model input

**Sentinel-Inspired Interface**:
A dark, map-first geospatial monitoring interface style used for wildfire risk decision support.
_Avoid_: Sentinel satellite processing, satellite fire detection, military command interface

**Mapbox Map Workspace**:
The MVP interactive satellite-style web map rendered with Mapbox GL JS and centered on Turkiye.
_Avoid_: Custom globe engine, static map mockup

**Curated Turkish Location Index**:
A local list of Turkish provinces, districts, cities, or demo locations used for reliable search and monitoring behavior.
_Avoid_: Sole external geocoder dependency

**Location Search Result**:
A resolved place or coordinate selected by the user for an **On-Demand Assessment**.
_Avoid_: Unresolved search text

**MVP Dashboard**:
The first deliverable dashboard that proves the end-to-end workflow from location selection to live weather input, model prediction, and advisory decision support.
_Avoid_: Full national operational platform

**Operational Dashboard Language**:
Interface wording that describes wildfire risk management, monitoring, weather signals, alerts, and recommended actions.
_Avoid_: Threat assessment, SIGINT, target, top secret, mission control

**Forest Officer**:
The primary user responsible for monitoring forested areas and taking preventive action based on wildfire risk.
_Avoid_: Citizen user

**Disaster Management Official**:
A secondary user responsible for reviewing regional risk and coordinating preparedness or response priorities.
_Avoid_: Public user

**Demo Role Selection**:
A non-authenticated MVP UI setting used to preview the dashboard from a **Forest Officer** or **Disaster Management Official** perspective.
_Avoid_: User account, permission role, access control

**Training-Only Feature**:
A feature present in the **Morocco Wildfire Dataset** but not reliably available to FIREWATCH DSS at prediction time.
_Avoid_: Live input

**Operational Risk Threshold**:
A versioned cutoff selected during model evaluation that maps a **Risk Score** into one of the four **Risk Levels** used by FIREWATCH DSS.
_Avoid_: Official national threshold

**Monitoring Location**:
A predefined Turkish province center, forest region, district, or other location that FIREWATCH DSS assesses for the national monitoring view.
_Avoid_: Sensor, station, nationwide coverage point

**Risk Level**:
The categorical severity assigned to a **Wildfire Risk Assessment**: low, medium, high, or critical.
_Avoid_: Fire status

**Priority Rank**:
A transparent operational sorting label used to order locations for monitoring attention.
_Avoid_: Dispatch priority, emergency severity order

**Priority Score**:
The calculated value used to assign a **Priority Rank** from factors such as **Risk Level**, **Risk Score**, **Risk Trend**, and data freshness.
_Avoid_: Hidden model output

**Monitoring Radius**:
A visual inspection radius around a selected location used to review nearby context and monitoring needs.
_Avoid_: Affected radius, burn radius, evacuation radius, spread radius

**Risk Alert**:
A system-generated warning created when a **Wildfire Risk Assessment** reaches a high or critical **Risk Level**.
_Avoid_: Official emergency alert, government alert

**Active Risk Alert**:
A current high or critical **Risk Alert** that has not expired, been superseded, or been reviewed and closed.
_Avoid_: Confirmed fire, official active emergency

**Risk Alert Expiry**:
The deterministic time when a **Risk Alert** stops being active unless superseded or reviewed earlier.
_Avoid_: Incident resolution, emergency end time

**Prediction History Record**:
A stored record of a completed **On-Demand Assessment** and its per-window **Wildfire Risk Assessments**.
_Avoid_: Incident record, confirmed wildfire history

**Observed Outcome**:
A later record of whether a wildfire occurrence was reported for the assessed location and time period.
_Avoid_: Model prediction, assumed fire

**Reviewed Outcome Entry**:
An **Observed Outcome** added or confirmed by an authorized user or imported from a trusted incident source after the prediction window.
_Avoid_: Automatic model feedback, unverified map signal

**Prediction Outcome Comparison**:
A comparison between a **Prediction History Record** and an **Observed Outcome** used to evaluate model performance.
_Avoid_: Proof of operational accuracy

**Outcome Matching Window**:
The spatial and temporal rule used to decide whether an **Observed Outcome** corresponds to a **Prediction History Record**.
_Avoid_: Informal match, assumed hit

**Model Tuning Dataset**:
A reviewed set of **Prediction Outcome Comparisons** used for offline model evaluation or retraining.
_Avoid_: Live self-learning data

**Recommended Action**:
An advisory decision-support suggestion tied to a **Risk Level**.
_Avoid_: Dispatch order, emergency command, official instruction

**Recommendation Rule Table**:
A deterministic mapping from **Risk Level** to approved **Recommended Actions**.
_Avoid_: LLM-generated policy, automatic dispatch logic

**Predicted Risk Hotspot**:
A location shown on the map because its **Wildfire Risk Assessment** indicates elevated wildfire risk.
_Avoid_: Satellite hotspot, thermal hotspot, active fire marker

**Demo Monitoring Data**:
Simulated or preloaded data used to populate national overview hotspots, heat zones, or unavailable operational layers during the prototype demonstration.
_Avoid_: Live operational feed, verified national coverage

**Data Source Label**:
A compact UI label that identifies whether displayed data is live, demo, estimated, cached, unavailable, or produced by a fallback.
_Avoid_: Hidden provenance

**On-Demand Assessment**:
A user-requested assessment for a selected location that contains one or more **Wildfire Risk Assessments** for requested **Forecast Windows**.
_Avoid_: Manual fire report

## Relationships

- The **Morocco Wildfire Dataset** is used as a **Proxy Training Dataset** for the prototype model.
- A **Proxy Training Dataset** creates a **Transfer Limitation** when applied to Turkiye.
- The final MVP should make the **Transfer Limitation** visible alongside model evidence such as feature schema, validation metrics, selected model, and threshold version.
- A **Wildfire Risk Assessment** uses only **Runtime Features**.
- A **Live Risk Assessment** uses **Weather Observations** or **Weather Forecast Inputs** from one **Weather API Source**.
- The **OpenWeather Source** is the MVP **Weather API Source**.
- **Cached Weather Data** can support a clearly labeled non-live assessment during **Degraded Data Status**.
- A **Cached Assessment View** must show the original weather timestamp and must not be stored as a new **Live Risk Assessment**.
- A **Weather Signal** may be displayed without being a **Prediction Input**.
- A **Prediction Input** is a **Runtime Feature** used by the model.
- A **Prediction Input** must use the documented canonical unit for its feature.
- A **Prediction Input** must be derivable at assessment time from the selected location, **Forecast Window**, calendar date, or **Weather API Source**.
- A selected location identifies where to assess and fetch weather, but raw coordinates are not **Prediction Inputs** for the deployed MVP model.
- A **Context Layer** may support decision-making without being a **Prediction Input**.
- A **Sentinel-Inspired Interface** presents **Wildfire Risk Assessments**, **Context Layers**, and **Recommended Actions** without implying remote-sensing analysis.
- A **Mapbox Map Workspace** is the MVP map implementation for the **Sentinel-Inspired Interface**.
- The **MVP Dashboard** centers on one end-to-end **Live Risk Assessment** workflow.
- **Operational Dashboard Language** is used throughout the **Sentinel-Inspired Interface**.
- A **Training-Only Feature** can inform future model improvements only after a reliable runtime source is added.
- A **Wildfire Risk Assessment** is derived from a **Risk Score**.
- A **Wildfire Risk Assessment** may include **Model Confidence** when the model provides class confidence.
- A **Model Explanation** explains the model output for one **Wildfire Risk Assessment**.
- A **Narrative Explanation** is generated from structured **Wildfire Risk Assessment** data.
- A **Narrative Explanation** should use **Operational Briefing Text**.
- An **Assessment Payload** contains only approved structured facts from one **Wildfire Risk Assessment**.
- An **LLM Advisory Layer** may produce a **Narrative Explanation** but does not produce the **Risk Score** or **Risk Level**.
- The **Groq Narrative Provider** supplies the MVP **LLM Advisory Layer**.
- An **External Service Key** enables one external integration.
- An **Integration Fallback** preserves a clear degraded state when an external integration is unavailable.
- A **Wildfire Risk Assessment** belongs to one **Forecast Window**.
- A **Priority Score** produces one **Priority Rank**.
- A **Monitoring Radius** is selected by the **Recommendation Rule Table** from the **Risk Level**.
- A **Risk Trend** compares two or more **Wildfire Risk Assessments** for the same location.
- A **Prototype Risk Estimate** reports **Relative Wildfire Risk**.
- An **Operational Risk Threshold** maps one **Risk Score** to one **Risk Level**.
- An **Operational Risk Threshold** belongs to one model version.
- A **Monitoring Location** can produce many **Wildfire Risk Assessments** over time.
- A **Wildfire Risk Assessment** has exactly one **Risk Level**.
- A **Risk Alert** is created from one high or critical **Wildfire Risk Assessment**.
- An **Active Risk Alert** is one current **Risk Alert**.
- A **Risk Alert Expiry** is selected by the **Recommendation Rule Table** for high and critical **Risk Levels**.
- An **On-Demand Assessment** contains one **Wildfire Risk Assessment** per requested **Forecast Window**.
- A **Prediction History Record** stores one completed **On-Demand Assessment**.
- An **Observed Outcome** is recorded as a **Reviewed Outcome Entry**.
- A **Prediction Outcome Comparison** links one **Prediction History Record** with one later **Observed Outcome** when outcome data is available.
- A **Prediction Outcome Comparison** must satisfy one **Outcome Matching Window** before it is used for evaluation or tuning.
- A **Model Tuning Dataset** is created from reviewed **Prediction Outcome Comparisons**.
- A **Recommendation Rule Table** selects the approved **Recommended Action**, **Monitoring Radius**, and **Risk Alert Expiry** before any **Narrative Explanation** is generated.
- A **Predicted Risk Hotspot** represents one elevated-risk **Wildfire Risk Assessment** on the map.
- **Demo Monitoring Data** may produce national overview **Predicted Risk Hotspots** for demonstration when live monitoring coverage is not implemented.
- **Demo Monitoring Data** must not create persistent **Risk Alerts** or **Active Risk Alerts**.
- A **Data Source Label** identifies the provenance or availability state of displayed data.
- A **Location Search Result** is created from the **Curated Turkish Location Index**, direct coordinates, or optional Mapbox geocoding.
- An **On-Demand Assessment** belongs to one **Location Search Result**.
- A **Forest Officer** uses **Wildfire Risk Assessments** for local monitoring and preventive action.
- A **Disaster Management Official** uses **Wildfire Risk Assessments** for regional prioritization and coordination.
- A **Demo Role Selection** changes presentation emphasis but does not grant or restrict access.

## Example Dialogue

> **Dev:** "Does a critical **Risk Level** mean there is already a fire?"
> **Domain expert:** "No. It means the weather conditions are highly favorable for ignition or rapid spread, so the area needs preventive attention."

## Flagged Ambiguities

- "hotspot" can mean a satellite-detected thermal anomaly in wildfire systems; in FIREWATCH DSS it means **Predicted Risk Hotspot** unless satellite fire detection is explicitly added later.
- "active alert" can sound like an official government emergency alert; in FIREWATCH DSS use **Risk Alert** for system-generated high or critical risk warnings.
- The national dashboard does not imply continuous assessment of every coordinate in Turkiye; it is based on predefined **Monitoring Locations**, while search creates an **On-Demand Assessment**.
- The four **Risk Levels** are operational decision-support categories derived from the model's **Risk Score** using **Operational Risk Thresholds**; they are not official Turkiye fire-danger classes.
- MVP **Operational Risk Thresholds** should be selected from model validation results, score distribution, and confusion-matrix review; demo defaults must be labeled as demo or configuration defaults.
- FIREWATCH DSS must present model evidence and the **Transfer Limitation** clearly; it must not imply validated operational accuracy for Turkiye.
- **Model Confidence** describes model class confidence only; it is not a validated real-world probability that a fire will occur.
- **Model Explanations** describe model behavior, not proven real-world wildfire causality.
- SHAP-style **Model Explanation** is a phase-two enhancement unless the core workflow is already solid.
- The **LLM Advisory Layer** must not invent weather factors, change the **Risk Level**, or override predefined **Recommended Actions**.
- The **LLM Advisory Layer** may phrase approved **Recommended Actions** but must not create new recommendations outside the **Recommendation Rule Table**.
- The **Groq Narrative Provider** is part of the MVP only as a narrative layer over structured assessment facts, with a deterministic template fallback if the provider is unavailable.
- The **LLM Advisory Layer** receives an **Assessment Payload**, not raw app state, and must generate short grounded text using only that payload.
- **Operational Briefing Text** must be concise, factual, non-alarmist, and free of military/security tone.
- External API credentials must be provided through **External Service Keys** such as Mapbox, OpenWeather, and Groq environment variables; secrets must not be hard-coded.
- Missing or failing external integrations must use an **Integration Fallback** and visibly report degraded status rather than pretending data is live.
- Because the model uses a **Proxy Training Dataset**, FIREWATCH DSS claims prototype **Relative Wildfire Risk** only; Turkiye-specific historical wildfire data would be required for operational validation.
- Runtime prediction must not depend on dataset columns that are unavailable for Turkish locations at request time; those columns are **Training-Only Features** unless reliable live or static sources are added.
- The deployed MVP model must exclude rich proxy dataset columns such as raw Morocco coordinates, station metadata, lagged coordinates, NDVI, SoilMoisture, long historical aggregates, and 15-day lag features unless each one has a reliable Turkish runtime source.
- Runtime prediction must not mix weather units; training and OpenWeather runtime values must be converted into the same documented metric feature schema before prediction.
- Selected-location predictions should use the **Weather API Source** for live current and forecast weather; the weather API is not a source of confirmed wildfire incidents.
- MVP selected-location predictions use the **OpenWeather Source** for current and forecast weather inputs.
- If the **Weather API Source** is unavailable, FIREWATCH DSS must not present a new unlabelled **Live Risk Assessment**; cached or demo data must be visibly labeled.
- If no matching **Cached Weather Data** exists during **Degraded Data Status**, FIREWATCH DSS should block selected-location assessment creation rather than fabricating a result.
- A **Cached Assessment View** is allowed only for the same location and **Forecast Window** as the cached weather record.
- National overview hotspots and unavailable operational layers may use **Demo Monitoring Data** when clearly labeled as simulated or demo data.
- Live, demo, estimated, cached, unavailable, and fallback data states should be shown through compact **Data Source Labels**.
- Map layers must distinguish **Prediction Inputs** from **Context Layers**; displaying a layer does not mean the model used it.
- MVP **Weather Signals** such as humidity, pressure, clouds, visibility, weather condition codes, and probability of precipitation are display context unless they are explicitly added to the deployed feature schema.
- **Sentinel-Inspired Interface** refers to interaction and visual style only; FIREWATCH DSS does not claim ESA Sentinel data processing, satellite fire detection, or remote-sensing analysis unless those capabilities are explicitly added later.
- FIREWATCH DSS copies Sentinel-style layout grammar, not Sentinel's military or intelligence semantics.
- The **MVP Dashboard** should prioritize the working risk assessment workflow over advanced geospatial layers, 3D globe mode, and tuning interfaces.
- The **Mapbox Map Workspace** is an interactive 2D satellite-style map for MVP; 3D globe mode is optional future work unless the core workflow is completed early.
- MVP search should use a **Curated Turkish Location Index** for reliable Turkish place lookup, with Mapbox geocoding as optional broader search support.
- Forecast views are created by applying the same runtime-compatible model to forecast weather inputs for each **Forecast Window**; FIREWATCH DSS does not claim separate fire-spread or time-series modeling.
- FIREWATCH DSS primarily supports the **Forest Officer** workflow; **Disaster Management Officials** are secondary coordination users.
- MVP role handling means **Demo Role Selection**, not authentication, authorization, user accounts, or role-based access control.
- **Recommended Actions** are advisory decision support only; they do not automatically dispatch resources or replace official emergency procedures.
- **Active Risk Alerts** are system-generated high or critical risk alerts; they are not confirmed fires or official emergency alerts.
- MVP **Risk Alert Expiry** values are advisory system lifetimes for alert review, not official emergency resolution times.
- In the MVP, persistent **Risk Alerts** are created only from live selected-location **Wildfire Risk Assessments**, not from demo overview data.
- In the MVP, **Priority Rank** should be derived mainly from **Risk Level**, **Risk Score**, **Risk Trend**, and data freshness; operational proximity factors can be added later.
- FIREWATCH DSS uses **Monitoring Radius**, not estimated affected radius; it is an inspection aid and not a predicted burn area, spread area, evacuation radius, or damage footprint.
- **Prediction History Records** are model assessment records, not confirmed wildfire incident records.
- **Prediction History Records** should group one user assessment request with its per-window results rather than presenting each **Forecast Window** as an unrelated assessment.
- **Prediction Outcome Comparisons**, **Reviewed Outcome Entries**, and **Model Tuning Datasets** are phase-two validation concepts, not MVP implementation requirements.
- **Observed Outcomes** can be used for evaluation and offline tuning only when they come from a reliable report, verified source, or reviewed manual entry.
- **Observed Outcomes** are added after the relevant **Forecast Window**; they are not inferred directly from the original model prediction or map visualization.
- **Prediction Outcome Comparisons** require an explicit spatial and temporal **Outcome Matching Window** before they can be used for evaluation or tuning.
- FIREWATCH DSS does not automatically update the model from new outcomes during live use; tuning is an offline evaluation or retraining workflow.
