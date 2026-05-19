import { useState } from "react";

import {
  formatConfidence,
  formatForecastWindow,
  formatLabel,
  formatReadingLabel,
  formatReadingValue,
  formatState,
  readingEntries,
} from "./dashboard/formatters";
import { type DemoRole, type ViewKey, VIEWS } from "./dashboard/types";
import { useAssessment } from "./dashboard/useAssessment";
import { useDashboardStatus } from "./dashboard/useDashboardStatus";
import { useLocationSearch } from "./dashboard/useLocationSearch";
import { useThemeMode } from "./dashboard/useThemeMode";

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

  const roleEmphasis =
    role === "Forest Officer" ? "Local monitoring emphasis" : "Coordination emphasis";

  const currentAssessment = assessmentPayload?.forecast_assessments?.[0];
  const modelInputEntries = readingEntries(currentAssessment?.model_input_drivers);
  const weatherSignalEntries = readingEntries(currentAssessment?.weather_signals);

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
          <div className="layer-list">
            <label className="layer-row">
              <input type="checkbox" defaultChecked />
              <span>
                <strong>Predicted hotspots</strong>
                <small>Demo overview</small>
              </span>
            </label>
            <label className="layer-row">
              <input type="checkbox" defaultChecked />
              <span>
                <strong>Weather signals</strong>
                <small>Live when selected</small>
              </span>
            </label>
            <label className="layer-row">
              <input type="checkbox" />
              <span>
                <strong>Province boundaries</strong>
                <small>Context layer</small>
              </span>
            </label>
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
          <div className="map-canvas" aria-label="Turkiye monitoring map">
            <span className="region-label central">Ankara</span>
            <span className="region-label west">Izmir</span>
            <span className="region-label south">Mugla</span>
            <span className="risk-marker risk-medium" aria-label="Medium risk marker" />
            <span className="risk-marker risk-high" aria-label="High risk marker" />
            <span className="risk-marker risk-critical" aria-label="Critical risk marker" />
            {selectedLocation ? (
              <span className="selected-map-focus" aria-label="Selected location map focus">
                {selectedLocation.display_name}
              </span>
            ) : null}
          </div>
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
                {currentAssessment ? formatLabel(currentAssessment.risk_level) : "Awaiting location"}
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
            <div>
              <dt>Model class confidence</dt>
              <dd>{formatConfidence(currentAssessment?.model_confidence)}</dd>
            </div>
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
