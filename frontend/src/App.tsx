import { useMemo, useState } from "react";

type ViewKey = "monitoring" | "history" | "status";
type DemoRole = "Forest Officer" | "Disaster Management Official";

const VIEWS: Record<ViewKey, string> = {
  monitoring: "Monitoring Dashboard",
  history: "Prediction History",
  status: "Model And Data Status",
};

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>("monitoring");
  const [role, setRole] = useState<DemoRole>("Forest Officer");

  const roleEmphasis = useMemo(() => {
    if (role === "Forest Officer") {
      return "Emphasis: local monitoring, patrol prioritization, and weather-driven inspection.";
    }

    return "Emphasis: regional prioritization, alert review, and coordination readiness.";
  }, [role]);

  return (
    <div className="app-shell">
      <header className="status-header">
        <div className="title-stack">
          <h1>FIREWATCH DSS</h1>
          <p>Weather-driven wildfire risk decision support for Turkiye</p>
        </div>
        <div className="status-pill-row" aria-label="integration status">
          <span className="status-pill live">Weather API: Unavailable</span>
          <span className="status-pill estimated">Model: Initializing</span>
          <span className="status-pill demo">Overview: Demo Monitoring Data</span>
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
          <p>Prediction Inputs and context layers appear here.</p>
        </aside>

        <section className="map-workspace" aria-label="Map Workspace">
          <h2>{VIEWS[activeView]}</h2>
          <p>Central map-first workspace placeholder for the MVP shell.</p>
        </section>

        <aside className="panel right-panel" aria-label="Decision Support Panel">
          <h2>Decision Support Panel</h2>
          <p>Risk level, recommendation, and monitoring radius surfaces.</p>
        </aside>
      </main>

      <section className="demo-role-panel" aria-label="Demo Role Selection">
        <h2>Demo Role Selection</h2>
        <p>Presentation emphasis only. No authentication or access control.</p>
        <div className="role-controls">
          <label>
            Demo role:
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
          <p>{roleEmphasis}</p>
        </div>
      </section>

      <footer className="bottom-strip" aria-label="Alerts and timeline strip">
        <h2>Alerts And Regional Timeline</h2>
        <p>Bottom strip placeholder for active risk alerts and forecast markers.</p>
      </footer>
    </div>
  );
}
