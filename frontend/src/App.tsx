import { type FormEvent, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";

import {
  formatConfidence,
  formatForecastWindow,
  formatLabel,
  formatReadingLabel,
  formatReadingValue,
  formatState,
  readingEntries,
} from "./dashboard/formatters";
import {
  type ActiveRiskAlert,
  type DemoRole,
  type MonitoringOverviewPayload,
  type PredictionHistoryRecord,
  type ViewKey,
  VIEWS,
} from "./dashboard/types";
import { useAssessment } from "./dashboard/useAssessment";
import { useDashboardStatus } from "./dashboard/useDashboardStatus";
import { useLocationSearch } from "./dashboard/useLocationSearch";
import { useThemeMode } from "./dashboard/useThemeMode";

type HistoryFilters = {
  region: string;
  startDate: string;
  endDate: string;
  riskLevel: string;
};

type LayerGroup = "prediction-inputs" | "context-layers";

type DataLayer = {
  id: string;
  label: string;
  group: LayerGroup;
  source: string;
  status: string;
  defaultActive: boolean;
  interactive: boolean;
  scope: "display-only" | "model-input";
};

const DATA_LAYERS: DataLayer[] = [
  {
    id: "prediction-weather-model-inputs",
    label: "Weather model inputs",
    group: "prediction-inputs",
    source: "Live when selected",
    status: "Updated per live assessment",
    defaultActive: true,
    interactive: false,
    scope: "model-input",
  },
  {
    id: "prediction-fuel-moisture-phase-two",
    label: "Fuel moisture proxy",
    group: "prediction-inputs",
    source: "Unavailable",
    status: "Phase-two layer",
    defaultActive: false,
    interactive: false,
    scope: "model-input",
  },
  {
    id: "context-predicted-hotspots",
    label: "Predicted hotspots context",
    group: "context-layers",
    source: "Demo monitoring data",
    status: "Display-only overlay",
    defaultActive: true,
    interactive: true,
    scope: "display-only",
  },
  {
    id: "context-weather-signals",
    label: "Weather signals context",
    group: "context-layers",
    source: "Live when selected",
    status: "Display-only panel",
    defaultActive: true,
    interactive: true,
    scope: "display-only",
  },
  {
    id: "context-province-boundaries",
    label: "Province boundaries context",
    group: "context-layers",
    source: "Demo",
    status: "Inactive",
    defaultActive: false,
    interactive: true,
    scope: "display-only",
  },
];

const buildHistoryUrl = (filters: HistoryFilters) => {
  const params = new URLSearchParams();
  if (filters.region) params.set("region", filters.region);
  if (filters.startDate) params.set("start_date", filters.startDate);
  if (filters.endDate) params.set("end_date", filters.endDate);
  if (filters.riskLevel) params.set("risk_level", filters.riskLevel);
  const query = params.toString();
  return query ? `/api/history?${query}` : "/api/history";
};

const formatDateTime = (timestamp: string) => {
  return timestamp.replace("T", " ").replace("Z", " UTC");
};

const formatHistoryWeatherSummary = (assessment: { weather_signals?: Record<string, string | number | null> }) => {
  const signals = assessment.weather_signals ?? {};
  const description = signals.weather_description;
  const humidity = signals.humidity_pct;
  const parts: string[] = [];
  if (typeof description === "string" && description) {
    parts.push(description);
  }
  if (humidity !== undefined && humidity !== null) {
    parts.push(`Humidity ${formatReadingValue("humidity_pct", humidity)}`);
  }
  return parts.length ? parts.join(", ") : "Not available";
};

const formatImpactDirection = (direction: string | undefined): string => {
  if (direction === "increases_risk") {
    return "increases risk";
  }
  if (direction === "decreases_risk") {
    return "decreases risk";
  }
  return "neutral impact";
};

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>("monitoring");
  const [role, setRole] = useState<DemoRole>("Forest Officer");
  const { themeMode, setThemeMode } = useThemeMode();
  const { weatherState, modelState } = useDashboardStatus();
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchMessage,
    setSearchMessage,
    isSearching,
    runLocationSearch,
  } = useLocationSearch();
  const { selectedLocation, assessmentPayload, isAssessing, selectLocationForAssessment } = useAssessment();
  const [monitoringOverview, setMonitoringOverview] = useState<MonitoringOverviewPayload | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<ActiveRiskAlert[]>([]);
  const [historyRecords, setHistoryRecords] = useState<PredictionHistoryRecord[]>([]);
  const [historyMessage, setHistoryMessage] = useState<string | null>(null);
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>({
    region: "",
    startDate: "",
    endDate: "",
    riskLevel: "",
  });
  const [mapboxError, setMapboxError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [layerState, setLayerState] = useState<Record<string, boolean>>(
    Object.fromEntries(DATA_LAYERS.map((layer) => [layer.id, layer.defaultActive]))
  );
  const mapToken = __MAPBOX_TOKEN__;
  const mapContainerId = "turkiye-mapbox-workspace";

  const roleEmphasis =
    role === "Forest Officer" ? "Local monitoring emphasis" : "Coordination emphasis";

  const currentAssessment = assessmentPayload?.forecast_assessments?.[0];
  const hasModelConfidence = typeof currentAssessment?.model_confidence === "number";
  const modelInputEntries = readingEntries(currentAssessment?.model_input_drivers);
  const modelExplanationImpacts = currentAssessment?.model_explanation?.top_feature_impacts ?? [];
  const modelExplanationLimitations = currentAssessment?.model_explanation?.limitations ?? [];
  const weatherSignalEntries = readingEntries(currentAssessment?.weather_signals);
  const showHotspots = layerState["context-predicted-hotspots"] ?? true;
  const showWeatherSignals = layerState["context-weather-signals"] ?? true;

  const loadHistoryRecords = async (filters: HistoryFilters) => {
    try {
      const response = await fetch(buildHistoryUrl(filters));
      if (!response.ok) {
        setHistoryRecords([]);
        setHistoryMessage("Prediction history is unavailable.");
        return;
      }
      const payload = (await response.json()) as {
        records?: PredictionHistoryRecord[];
        message?: string | null;
      };
      setHistoryRecords(Array.isArray(payload.records) ? payload.records : []);
      setHistoryMessage(payload.message ?? null);
    } catch {
      setHistoryRecords([]);
      setHistoryMessage("Prediction history is unavailable.");
    }
  };

  const applyHistoryFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadHistoryRecords(historyFilters);
  };

  useEffect(() => {
    const loadOverview = async () => {
      try {
        const response = await fetch("/api/monitoring/overview");
        if (!response.ok) {
          return;
        }
        setMonitoringOverview((await response.json()) as MonitoringOverviewPayload);
      } catch {
        // Keep static fallback map details when overview fetch is unavailable.
      }
    };
    void loadOverview();
  }, []);

  useEffect(() => {
    const loadActiveAlerts = async () => {
      try {
        const response = await fetch("/api/alerts/active");
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { alerts?: ActiveRiskAlert[] };
        setActiveAlerts(Array.isArray(payload.alerts) ? payload.alerts : []);
      } catch {
        setActiveAlerts([]);
      }
    };
    void loadActiveAlerts();
  }, [assessmentPayload]);

  useEffect(() => {
    if (activeView !== "history") {
      return;
    }

    void loadHistoryRecords(historyFilters);
  }, [activeView]);

  useEffect(() => {
    if (activeView === "history") {
      setMapReady(false);
      return;
    }

    if (!mapToken) {
      setMapboxError("Mapbox unavailable - token missing.");
      setMapReady(false);
      return;
    }

    const mapContainer = document.getElementById(mapContainerId);
    if (!mapContainer) {
      return;
    }

    mapboxgl.accessToken = mapToken;
    let hasLoaded = false;
    const loadTimeout = window.setTimeout(() => {
      if (!hasLoaded) {
        setMapboxError("Mapbox unavailable - load timeout.");
      }
    }, 10000);

    const map = new mapboxgl.Map({
      container: mapContainer,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [35.2433, 38.9637],
      zoom: 4.6,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      hasLoaded = true;
      setMapboxError(null);
      setMapReady(true);
      if (showHotspots) {
        const hotspots = monitoringOverview?.predicted_risk_hotspots ?? [];
        hotspots.forEach((hotspot) => {
          new mapboxgl.Marker({ color: "#c94f4f" })
            .setLngLat([hotspot.longitude, hotspot.latitude])
            .setPopup(
              new mapboxgl.Popup({ offset: 14 }).setText(
                `${hotspot.name} - ${hotspot.label} (${hotspot.risk_level})`
              )
            )
            .addTo(map);
        });
      }
    });

    map.on("error", (event) => {
      const errorText = String(
        (event as { error?: { message?: string } })?.error?.message ?? ""
      ).toLowerCase();
      const authError =
        errorText.includes("access token") ||
        errorText.includes("unauthorized") ||
        errorText.includes("forbidden") ||
        errorText.includes("401") ||
        errorText.includes("403");

      if (!hasLoaded && authError) {
        setMapboxError(
          `Mapbox unavailable - token rejected by Mapbox.${errorText ? ` ${errorText}` : ""}`
        );
      } else if (!hasLoaded && errorText) {
        setMapboxError(`Mapbox unavailable - ${errorText}`);
      }
    });

    return () => {
      window.clearTimeout(loadTimeout);
      setMapReady(false);
      map.remove();
    };
  }, [activeView, mapToken, monitoringOverview, showHotspots]);

  return (
    <div className="app-shell" data-theme={themeMode}>
      <header className="status-header">
        <div className="title-stack">
          <h1>FIREWATCH DSS</h1>
          <p>Weather-driven wildfire risk decision support for Turkiye</p>
        </div>
        <div className="header-controls">
          <form className="search-form" onSubmit={runLocationSearch}>
            <label className="search-control">
              <span>Location search</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Izmir, Mugla, 39.9, 32.8"
              />
            </label>
            <button type="submit" className="search-submit">
              {isSearching ? "Searching..." : "Search locations"}
            </button>
          </form>
          {searchMessage ? <p className="search-message">{searchMessage}</p> : null}
          {searchResults.length > 0 ? (
            <div className="search-results" aria-label="Location search results">
              {searchResults.map((result) => (
                <button
                  key={`${result.display_name}-${result.latitude}-${result.longitude}`}
                  type="button"
                  className="search-result-item"
                  onClick={() => void selectLocationForAssessment(result, () => setSearchMessage(null))}
                >
                  {result.display_name}
                </button>
              ))}
            </div>
          ) : null}
          <p className="selected-location-state">
            Selected location: {selectedLocation?.display_name ?? "None"}
          </p>
          <div className="chrome-control-row">
            <label className="role-control">
              <span>Demo role</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as DemoRole)}
              >
                <option value="Forest Officer">Forest Officer</option>
                <option value="Disaster Management Official">
                  Disaster Management Official
                </option>
              </select>
            </label>
            <div className="theme-control" aria-label="Theme mode">
              <button
                type="button"
                className={themeMode === "light" ? "selected" : ""}
                aria-pressed={themeMode === "light"}
                onClick={() => setThemeMode("light")}
              >
                Light theme
              </button>
              <button
                type="button"
                className={themeMode === "dark" ? "selected" : ""}
                aria-pressed={themeMode === "dark"}
                onClick={() => setThemeMode("dark")}
              >
                Dark theme
              </button>
            </div>
          </div>
          <div className="status-pill-row" aria-label="integration status">
            <span className="status-pill live">Weather API: {formatState(weatherState)}</span>
            <span className="status-pill estimated">Model: {formatState(modelState)}</span>
            <span className="status-pill demo">Overview: Demo Monitoring Data</span>
          </div>
        </div>
      </header>

      <nav className="view-tabs" aria-label="Primary dashboard views">
        {(Object.keys(VIEWS) as ViewKey[]).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => setActiveView(view)}
            className={`view-tab ${activeView === view ? "active" : ""}`}
          >
            {VIEWS[view]}
          </button>
        ))}
      </nav>

      <main className="workspace-grid">
        <aside className="panel left-panel" aria-label="Data Layers">
          <h2>Data Layers</h2>
          <h3>Prediction Inputs</h3>
          <div className="layer-list">
            {DATA_LAYERS.filter((layer) => layer.group === "prediction-inputs").map((layer) => {
              const isActive = layerState[layer.id];
              return (
                <label key={layer.id} className="layer-row">
                  <span
                    className={`layer-lock-indicator ${isActive ? "active" : "inactive"}`}
                    aria-label={`Model-linked prediction input: ${isActive ? "active" : "inactive"}`}
                  />
                  <span>
                    <strong>{layer.label}</strong>
                    <small>State: {isActive ? "Active" : "Inactive"}</small>
                    <small>Source: {layer.source}</small>
                    <small>{layer.status} - Model-linked (not display toggle)</small>
                  </span>
                </label>
              );
            })}
          </div>
          <h3>Context Layers</h3>
          <div className="layer-list">
            {DATA_LAYERS.filter((layer) => layer.group === "context-layers").map((layer) => {
              const isActive = layerState[layer.id];
              return (
                <label key={layer.id} className="layer-row">
                  <input
                    type="checkbox"
                    aria-label={layer.label}
                    checked={isActive}
                    onChange={(event) =>
                      setLayerState((current) => ({ ...current, [layer.id]: event.target.checked }))
                    }
                    disabled={!layer.interactive}
                  />
                  <span>
                    <strong>{layer.label}</strong>
                    <small>State: {isActive ? "Active" : "Inactive"}</small>
                    <small>Source: {layer.source}</small>
                    <small>{layer.status}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </aside>

        <section className="map-workspace" aria-label="Map Workspace">
          <div className="map-toolbar">
            <div>
              <h2>{VIEWS[activeView]}</h2>
              <p>
                {selectedLocation
                  ? `Map focus: ${selectedLocation.display_name}`
                  : "Turkiye national monitoring overview"}
              </p>
            </div>
            <span className="source-label">
              {formatLabel(assessmentPayload?.data_source_labels?.assessment ?? "demo")}
            </span>
          </div>
          {activeView === "history" ? (
            <div className="history-view" aria-label="Prediction History Records">
              <form className="history-filters" onSubmit={applyHistoryFilters}>
                <label>
                  <span>History region filter</span>
                  <input
                    value={historyFilters.region}
                    onChange={(event) =>
                      setHistoryFilters((filters) => ({ ...filters, region: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>History start date</span>
                  <input
                    type="date"
                    value={historyFilters.startDate}
                    onChange={(event) =>
                      setHistoryFilters((filters) => ({ ...filters, startDate: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>History end date</span>
                  <input
                    type="date"
                    value={historyFilters.endDate}
                    onChange={(event) =>
                      setHistoryFilters((filters) => ({ ...filters, endDate: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>History risk level</span>
                  <select
                    value={historyFilters.riskLevel}
                    onChange={(event) =>
                      setHistoryFilters((filters) => ({ ...filters, riskLevel: event.target.value }))
                    }
                  >
                    <option value="">Any</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
                <button type="submit" className="search-submit">
                  Apply history filters
                </button>
              </form>
              <div className="history-records">
                <h3>Prediction History Records</h3>
                {historyRecords.length ? (
                  historyRecords.map((record) => (
                    <article key={record.id} className="history-record">
                      <div className="history-record-header">
                        <div>
                          <strong>{record.location.name ?? "Selected location"}</strong>
                          <p>{formatDateTime(record.assessment_timestamp)}</p>
                          <p>
                            Requested windows:{" "}
                            {record.requested_forecast_windows.map(formatForecastWindow).join(", ")}
                          </p>
                        </div>
                        <div className="source-label-grid">
                          <span className="source-label">
                            Assessment: {formatLabel(record.data_source_labels?.assessment)}
                          </span>
                          <span className="source-label">
                            Weather: {formatLabel(record.data_source_labels?.weather)}
                          </span>
                        </div>
                      </div>
                      <div className="history-window-grid">
                        {record.forecast_assessments.map((assessment) => (
                          <div key={`${record.id}-${assessment.forecast_window}`} className="history-window-row">
                            <strong>{formatForecastWindow(assessment.forecast_window)}</strong>
                            <span>Risk score: {assessment.risk_score.toFixed(2)}</span>
                            <span>Risk level: {formatLabel(assessment.risk_level)}</span>
                            <span>Recommended action: {assessment.recommended_action}</span>
                            <span>Alert: {formatLabel(assessment.risk_alert_status ?? "not-created")}</span>
                            <span>Weather: {formatHistoryWeatherSummary(assessment)}</span>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))
                ) : (
                  <p>{historyMessage ?? "No prediction history records found."}</p>
                )}
              </div>
            </div>
          ) : (
            <div className={`map-canvas ${mapReady ? "map-ready" : ""}`} aria-label="Turkiye monitoring map">
              <div id={mapContainerId} className="mapbox-canvas" />
              {!mapReady ? (
                <>
                  <span className="region-label central">Ankara</span>
                  <span className="region-label west">Izmir</span>
                  <span className="region-label south">Mugla</span>
                  <span className="risk-marker risk-medium" aria-label="Medium risk marker" />
                  <span className="risk-marker risk-high" aria-label="High risk marker" />
                  <span className="risk-marker risk-critical" aria-label="Critical risk marker" />
                </>
              ) : null}
              {showHotspots &&
                monitoringOverview?.predicted_risk_hotspots?.map((hotspot) => (
                <span key={hotspot.name} className={`region-label ${hotspot.risk_level}`}>
                  {hotspot.name} - {hotspot.label}
                </span>
                ))}
              {mapboxError ? <span className="mapbox-fallback">{mapboxError}</span> : null}
              {selectedLocation ? (
                <span className="selected-map-focus" aria-label="Selected location map focus">
                  {selectedLocation.display_name}
                </span>
              ) : null}
            </div>
          )}
        </section>

        <aside className="panel right-panel" aria-label="Decision Support Panel">
          <h2>Decision Support Panel</h2>
          <p className="role-emphasis">{roleEmphasis}</p>
          {isAssessing ? <p className="assessment-state">Creating live assessment...</p> : null}
          <div className="assessment-card">
            <div>
              <span className="eyebrow">Selected area</span>
              <strong>{selectedLocation?.display_name ?? "No location selected"}</strong>
            </div>
            {currentAssessment ? (
              <span className={`risk-badge ${currentAssessment.risk_level}`}>
                {formatLabel(currentAssessment.risk_level)}
              </span>
            ) : (
              <span className="risk-badge unavailable">
                {assessmentPayload?.source_state === "degraded" ? "Degraded" : "No assessment"}
              </span>
            )}
          </div>
          <dl className="assessment-metrics">
            <div>
              <dt>Risk level</dt>
              <dd>
                {currentAssessment
                  ? formatLabel(currentAssessment.risk_level)
                  : assessmentPayload?.source_state === "degraded"
                    ? "Assessment unavailable"
                    : "Awaiting location"}
              </dd>
            </div>
            <div>
              <dt>Forecast window</dt>
              <dd>{currentAssessment ? formatForecastWindow(currentAssessment.forecast_window) : "Not available"}</dd>
            </div>
            <div>
              <dt>Risk score</dt>
              <dd>{currentAssessment ? currentAssessment.risk_score.toFixed(2) : "Not available"}</dd>
            </div>
            {hasModelConfidence ? (
              <div>
                <dt>Model class confidence</dt>
                <dd>{formatConfidence(currentAssessment?.model_confidence)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Risk trend</dt>
              <dd>{currentAssessment?.risk_trend ? formatLabel(currentAssessment.risk_trend) : "Not available"}</dd>
            </div>
            <div>
              <dt>Priority rank</dt>
              <dd>{currentAssessment?.priority_rank ?? "Not available"}</dd>
            </div>
            <div>
              <dt>Monitoring radius</dt>
              <dd>{currentAssessment?.monitoring_radius ?? "Not available"}</dd>
            </div>
            <div>
              <dt>Recommended action</dt>
              <dd>{currentAssessment?.recommended_action ?? "Not available"}</dd>
            </div>
            <div>
              <dt>Operational briefing</dt>
              <dd>
                {currentAssessment?.narrative_explanation ??
                  assessmentPayload?.message ??
                  "Select a location to request a live assessment."}
              </dd>
            </div>
          </dl>
          {assessmentPayload ? (
            <div className="reading-groups">
              <div className="reading-group" role="group" aria-label="Model input drivers">
                <h3>Model input drivers</h3>
                <dl className="reading-list">
                  {modelInputEntries.length ? (
                    modelInputEntries.map(([key, value]) => (
                      <div key={key}>
                        <dt>{formatReadingLabel(key)}</dt>
                        <dd>{formatReadingValue(key, value)}</dd>
                      </div>
                    ))
                  ) : (
                    <div>
                      <dt>Prediction inputs</dt>
                      <dd>Not available</dd>
                    </div>
                  )}
                </dl>
              </div>
              <div className="reading-group" role="group" aria-label="Model behavior explanation">
                <h3>Model behavior explanation</h3>
                <p>
                  {currentAssessment?.model_explanation?.label ??
                    "Model behavior explanation (not causal proof)."}
                </p>
                <dl className="reading-list">
                  {modelExplanationImpacts.length ? (
                    modelExplanationImpacts.map((impact) => (
                      <div key={`${impact.feature_name}-${impact.direction}`}>
                        <dt>{formatReadingLabel(impact.feature_name)}</dt>
                        <dd>
                          {`${formatImpactDirection(impact.direction)} (delta ${impact.contribution_to_risk_score.toFixed(3)})`}
                        </dd>
                      </div>
                    ))
                  ) : (
                    <div>
                      <dt>Top feature impacts</dt>
                      <dd>Not available</dd>
                    </div>
                  )}
                </dl>
                {modelExplanationLimitations.length ? (
                  <p>{modelExplanationLimitations[0]}</p>
                ) : null}
              </div>
              {showWeatherSignals ? (
                <div className="reading-group" role="group" aria-label="Display-only weather signals">
                  <h3>Weather Signals</h3>
                  <dl className="reading-list">
                    {weatherSignalEntries.length ? (
                      weatherSignalEntries.map(([key, value]) => (
                        <div key={key}>
                          <dt>{formatReadingLabel(key)}</dt>
                          <dd>{formatReadingValue(key, value)}</dd>
                        </div>
                      ))
                    ) : (
                      <div>
                        <dt>Display context</dt>
                        <dd>Not available</dd>
                      </div>
                    )}
                  </dl>
                </div>
              ) : null}
            </div>
          ) : null}
          {assessmentPayload ? (
            <div className="source-label-grid" aria-label="Assessment source labels">
              <span className="source-label">
                Assessment: {formatLabel(assessmentPayload.data_source_labels?.assessment)}
              </span>
              <span className="source-label">
                Weather: {formatLabel(assessmentPayload.data_source_labels?.weather)}
              </span>
              <span className="source-label">
                Narrative: {formatLabel(assessmentPayload.data_source_labels?.narrative)}
              </span>
            </div>
          ) : null}
        </aside>
      </main>

      <footer className="bottom-strip" aria-label="Alerts and timeline strip">
        <div>
          <h2>Alerts And Regional Timeline</h2>
          <p>Active Risk Alerts and forecast markers</p>
        </div>
        <div className="timeline-items" aria-label="Active risk alerts">
          {activeAlerts.length ? (
            activeAlerts.map((alert) => (
              <span key={alert.id} className={`window-risk ${alert.risk_level}`}>
                {alert.alert_text}
              </span>
            ))
          ) : (
            <span>No active risk alerts.</span>
          )}
        </div>
        <div className="timeline-items" aria-label="Forecast windows">
          {assessmentPayload?.forecast_assessments?.length ? (
            assessmentPayload.forecast_assessments.map((assessment) => (
              <span key={assessment.forecast_window} className={`window-risk ${assessment.risk_level}`}>
                {formatForecastWindow(assessment.forecast_window)}: {formatLabel(assessment.risk_level)}
              </span>
            ))
          ) : (
            <>
              <span>Now</span>
              <span>24h</span>
              <span>48h</span>
              <span>72h</span>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
