import { useEffect, useState } from "react";

type ViewKey = "monitoring" | "history" | "status";
type DemoRole = "Forest Officer" | "Disaster Management Official";
type StatusState = "configured" | "missing" | "unavailable";
type ThemeMode = "light" | "dark";

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

const VIEWS: Record<ViewKey, string> = {
  monitoring: "Monitoring Dashboard",
  history: "Prediction History",
  status: "Model And Data Status",
};

const THEME_STORAGE_KEY = "firewatch-theme";

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

  return (
    <div className="app-shell" data-theme={themeMode}>
      <header className="status-header">
        <div className="title-stack">
          <h1>FIREWATCH DSS</h1>
          <p>Weather-driven wildfire risk decision support for Turkiye</p>
        </div>
        <div className="header-controls">
          <label className="search-control">
            <span>Location search</span>
            <input type="search" placeholder="Izmir, Mugla, 39.9, 32.8" />
          </label>
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
              <p>Turkiye national monitoring overview</p>
            </div>
            <span className="source-label">Demo</span>
          </div>
          <div className="map-canvas" aria-label="Turkiye monitoring map">
            <span className="region-label central">Ankara</span>
            <span className="region-label west">Izmir</span>
            <span className="region-label south">Mugla</span>
            <span className="risk-marker risk-medium" aria-label="Medium risk marker" />
            <span className="risk-marker risk-high" aria-label="High risk marker" />
            <span className="risk-marker risk-critical" aria-label="Critical risk marker" />
          </div>
        </section>

        <aside className="panel right-panel" aria-label="Decision Support Panel">
          <h2>Decision Support Panel</h2>
          <div className="assessment-card">
            <div>
              <span className="eyebrow">Selected area</span>
              <strong>Mugla forest region</strong>
            </div>
            <span className="risk-badge high">High</span>
          </div>
          <dl className="assessment-metrics">
            <div>
              <dt>Risk score</dt>
              <dd>0.78</dd>
            </div>
            <div>
              <dt>Monitoring radius</dt>
              <dd>20 km</dd>
            </div>
            <div>
              <dt>Recommended action</dt>
              <dd>Prioritize local inspection</dd>
            </div>
          </dl>
        </aside>
      </main>

      <footer className="bottom-strip" aria-label="Alerts and timeline strip">
        <div>
          <h2>Alerts And Regional Timeline</h2>
          <p>Active Risk Alerts and forecast markers</p>
        </div>
        <div className="timeline-items" aria-label="Forecast windows">
          <span>Now</span>
          <span>24h</span>
          <span>48h</span>
          <span>72h</span>
        </div>
      </footer>
    </div>
  );
}
