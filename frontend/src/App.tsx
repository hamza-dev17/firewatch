import { useEffect, useState, type FormEvent } from "react";

type ViewKey = "monitoring" | "history" | "status";
type DemoRole = "Forest Officer" | "Disaster Management Official";
type StatusState = "configured" | "missing" | "unavailable";
type ThemeMode = "light" | "dark";
type AssessmentSourceState = "live" | "degraded" | "cached" | "unavailable";

type ApiStatusPayload = {
  integrations?: {
    openweather?: StatusState;
  };
  runtime?: {
    model_artifact?: {
      state?: StatusState;
    };
  };
};

type LocationSearchResult = {
  display_name: string;
  latitude: number;
  longitude: number;
  admin: {
    province: string;
    district: string;
    country: string;
  };
  source_label: string;
};

type LocationSearchPayload = {
  results?: LocationSearchResult[];
  message?: string | null;
};

type AssessmentWindowResult = {
  forecast_window: string;
  risk_level: string;
  risk_score: number;
  model_confidence?: number | null;
  risk_trend?: string;
  priority_rank?: string;
  monitoring_radius: string;
  recommended_action: string;
  model_input_drivers?: Record<string, string | number | null>;
  weather_signals?: Record<string, string | number | null>;
  narrative_explanation?: string;
  narrative_source_label?: string;
};

type AssessmentPayload = {
  source_state: AssessmentSourceState;
  location?: {
    name: string;
    latitude: number;
    longitude: number;
    source: string;
  };
  forecast_assessments?: AssessmentWindowResult[];
  data_source_labels?: {
    assessment?: string;
    weather?: string;
    narrative?: string;
  };
  message?: string | null;
};

const VIEWS: Record<ViewKey, string> = {
  monitoring: "Monitoring Dashboard",
  history: "Prediction History",
  status: "Model And Data Status",
};

const THEME_STORAGE_KEY = "firewatch-theme";
const ASSESSMENT_WINDOWS = ["now", "24h", "48h", "72h"];
const READING_LABELS: Record<string, string> = {
  temperature_c: "Temperature",
  temperature_min_c: "Minimum temperature",
  temperature_max_c: "Maximum temperature",
  rain_mm: "Rainfall",
  wind_speed_mps: "Wind speed",
  wind_gust_mps: "Wind gust",
  humidity_pct: "Humidity",
  pressure_hpa: "Pressure",
  cloud_cover_pct: "Cloud cover",
  visibility_m: "Visibility",
  weather_description: "Weather",
  precipitation_probability_pct: "Precipitation probability",
};
const READING_UNITS: Record<string, string> = {
  temperature_c: "C",
  temperature_min_c: "C",
  temperature_max_c: "C",
  rain_mm: "mm",
  wind_speed_mps: "m/s",
  wind_gust_mps: "m/s",
  humidity_pct: "%",
  pressure_hpa: "hPa",
  cloud_cover_pct: "%",
  visibility_m: "m",
  precipitation_probability_pct: "%",
};

const getSavedTheme = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
};

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>("monitoring");
  const [role, setRole] = useState<DemoRole>("Forest Officer");
  const [themeMode, setThemeMode] = useState<ThemeMode>(getSavedTheme);
  const [weatherState, setWeatherState] = useState<StatusState>("unavailable");
  const [modelState, setModelState] = useState<StatusState>("unavailable");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null);
  const [assessmentPayload, setAssessmentPayload] = useState<AssessmentPayload | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    const controller = new AbortController();

    const loadStatus = async () => {
      try {
        const response = await fetch("/api/status", { signal: controller.signal });
        if (!response.ok) {
          setWeatherState("unavailable");
          setModelState("unavailable");
          return;
        }

        const payload = (await response.json()) as ApiStatusPayload;
        setWeatherState(payload.integrations?.openweather ?? "unavailable");
        setModelState(payload.runtime?.model_artifact?.state ?? "unavailable");
      } catch {
        setWeatherState("unavailable");
        setModelState("unavailable");
      }
    };

    void loadStatus();

    return () => controller.abort();
  }, []);

  const formatState = (state: StatusState): string => {
    return state[0].toUpperCase() + state.slice(1);
  };

  const formatLabel = (label: string | undefined): string => {
    if (!label) {
      return "Unavailable";
    }

    return label
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(" ");
  };

  const formatForecastWindow = (window: string): string => {
    return window === "now" ? "Now" : window;
  };

  const formatConfidence = (confidence: number | null | undefined): string => {
    if (typeof confidence !== "number") {
      return "Not available";
    }

    return `${Math.round(confidence * 100)}%`;
  };

  const formatReadingLabel = (key: string): string => {
    return READING_LABELS[key] ?? formatLabel(key);
  };

  const formatReadingValue = (key: string, value: string | number | null): string => {
    if (value === null || value === undefined || value === "") {
      return "Not available";
    }

    const unit = READING_UNITS[key];
    if (typeof value === "number") {
      const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(1);
      return unit === "%" ? `${formatted}%` : unit ? `${formatted} ${unit}` : formatted;
    }

    return unit === "%" ? `${value}%` : unit ? `${value} ${unit}` : value;
  };

  const readingEntries = (readings: Record<string, string | number | null> | undefined) => {
    return Object.entries(readings ?? {}).filter(([, value]) => value !== null && value !== undefined);
  };

  const roleEmphasis =
    role === "Forest Officer" ? "Local monitoring emphasis" : "Coordination emphasis";

  const selectLocationForAssessment = async (location: LocationSearchResult) => {
    setSelectedLocation(location);
    setAssessmentPayload(null);
    setSearchMessage(null);
    setIsAssessing(true);

    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: {
            name: location.display_name,
            latitude: location.latitude,
            longitude: location.longitude,
            source: location.source_label,
          },
          forecast_windows: ASSESSMENT_WINDOWS,
        }),
      });

      if (!response.ok) {
        setAssessmentPayload({
          source_state: "degraded",
          forecast_assessments: [],
          data_source_labels: {
            assessment: "unavailable",
            weather: "unavailable",
            narrative: "unavailable",
          },
          message: "Assessment service is unavailable.",
        });
        return;
      }

      setAssessmentPayload((await response.json()) as AssessmentPayload);
    } catch {
      setAssessmentPayload({
        source_state: "degraded",
        forecast_assessments: [],
        data_source_labels: {
          assessment: "unavailable",
          weather: "unavailable",
          narrative: "unavailable",
        },
        message: "Assessment service is unavailable.",
      });
    } finally {
      setIsAssessing(false);
    }
  };

  const runLocationSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchMessage("Enter a province, district, city, or coordinates.");
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/locations/search?q=${encodeURIComponent(trimmed)}`);
      if (!response.ok) {
        setSearchResults([]);
        setSearchMessage("Location search is unavailable.");
        return;
      }

      const payload = (await response.json()) as LocationSearchPayload;
      setSearchResults(payload.results ?? []);
      setSearchMessage(payload.message ?? null);
    } catch {
      setSearchResults([]);
      setSearchMessage("Location search is unavailable.");
    } finally {
      setIsSearching(false);
    }
  };

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
                  onClick={() => void selectLocationForAssessment(result)}
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
