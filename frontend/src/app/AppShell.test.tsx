import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./MapCanvas", () => ({
  MapCanvas: ({
    activeAlerts = [],
    overview = null,
    selectedLocation,
  }: {
    activeAlerts?: Array<{ location_name: string }>;
    overview?: {
      regional_summaries?: Array<{ region: string; risk_level: string }>;
    } | null;
    selectedLocation?: { display_name: string } | null;
  }) => (
    <section aria-label="Türkiye monitoring map">
      {selectedLocation ? `Map focus: ${selectedLocation.display_name}` : null}
      {activeAlerts.map((alert) => <span key={alert.location_name}>Map alert: {alert.location_name}</span>)}
      {overview?.regional_summaries?.map((summary) => (
        <span key={`${summary.region}-${summary.risk_level}`}>Map overview: {summary.region} {summary.risk_level}</span>
      ))}
    </section>
  ),
}));

import { AppShell } from "./AppShell";

describe("AppShell", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders the map-first workspace with a bottom bar", () => {
    render(<AppShell />);

    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("region", { name: "Türkiye monitoring map" })
    );
    expect(screen.getByRole("status", { name: "Operational status" })).toBeInTheDocument();
  });

  it("shows ambient monitoring overview and active risk alerts", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/monitoring/refresh") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ source_state: "live", refreshed: [], skipped: [], failed: [] }),
        });
      }

      if (url === "/api/monitoring/overview") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            source_state: "live",
            monitoring_locations: [
              { name: "Ankara", latitude: 39.9334, longitude: 32.8597, data_source_label: "system-watchlist" },
              { name: "Izmir", latitude: 38.4237, longitude: 27.1428, data_source_label: "system-watchlist" },
            ],
            predicted_risk_hotspots: [],
            regional_summaries: [
              { region: "Ankara", risk_level: "low", risk_score: 0.21, assessed_at: "2026-05-31T10:00:00Z", data_source_label: "system-watchlist-history" },
              { region: "Izmir", risk_level: "medium", risk_score: 0.51, assessed_at: "2026-05-31T10:30:00Z", data_source_label: "system-watchlist-history" },
              { region: "Antalya", risk_level: "pending", priority_rank: "PENDING", data_source_label: "system-watchlist" },
            ],
            top_priority_regions: [],
          }),
        });
      }

      if (url === "/api/alerts/active") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            alerts: [
              {
                id: "alert-1",
                created_at: "2026-05-31T09:00:00Z",
                expires_at: "2026-05-31T12:00:00Z",
                status: "active",
                recommendation_rule_version: "v1",
                location_name: "Mugla",
                latitude: 37.2153,
                longitude: 28.3636,
                forecast_window: "now",
                risk_level: "high",
                risk_score: 0.91,
                recommended_action: "Prioritize local inspection",
                alert_text: "High relative wildfire risk",
              },
            ],
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppShell />);

    const rail = await screen.findByRole("complementary", { name: "Ambient monitoring" });
    expect(await within(rail).findByText("Mugla")).toBeInTheDocument();
    expect(within(rail).getByText("RISK OVERVIEW")).toBeInTheDocument();
    expect(within(rail).getByText("0 REGIONS", { selector: ".critical" })).toBeInTheDocument();
    expect(within(rail).getByText("0 REGIONS", { selector: ".high" })).toBeInTheDocument();
    expect(within(rail).getByText("1 REGION", { selector: ".medium" })).toBeInTheDocument();
    expect(within(rail).getByText("1 REGION", { selector: ".low" })).toBeInTheDocument();
    expect(within(rail).getByText("1 REGION", { selector: ".pending" })).toBeInTheDocument();
    expect(within(rail).getByText("Ankara")).toBeInTheDocument();
    expect(within(rail).getByText("LOW")).toBeInTheDocument();
    expect(within(rail).getByText("Izmir")).toBeInTheDocument();
    expect(within(rail).getByText("MEDIUM")).toBeInTheDocument();
    expect(within(rail).getByText("Antalya")).toBeInTheDocument();
    expect(within(rail).getByText("PENDING")).toBeInTheDocument();
    expect(within(rail).getByText("PRIORITY WATCH REGIONS")).toBeInTheDocument();
    expect(within(rail).getByText("System watchlist, max 10 locations")).toBeInTheDocument();
    expect(within(rail).getByText("ACTIVE RISK ALERTS")).toBeInTheDocument();
    expect(within(rail).getByText("NOW")).toBeInTheDocument();
    expect(screen.getByText("Map alert: Mugla")).toBeInTheDocument();
    expect(screen.getByText("Map overview: Izmir medium")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/monitoring/refresh", { method: "POST" });
    expect(fetchMock).toHaveBeenCalledWith("/api/monitoring/overview");
    expect(fetchMock).toHaveBeenCalledWith("/api/alerts/active");
  });

  it("starts dark and persists the selected theme", () => {
    render(<AppShell />);

    const shell = screen.getByTestId("app-shell");
    const lightMode = screen.getByRole("button", { name: "Light theme" });
    expect(shell).toHaveAttribute("data-theme", "dark");

    fireEvent.click(lightMode);

    expect(shell).toHaveAttribute("data-theme", "light");
    expect(window.localStorage.getItem("firewatch-theme")).toBe("light");
  });

  it("opens settings from the top bar with model, dataset, and degraded integration status", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/status") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            integrations: {
              openweather: "missing",
              mapbox: "configured",
              groq: "configured",
            },
            runtime: {
              model_artifact: {
                state: "configured",
                path: "ml/models/firewatch.pkl",
                version: "prototype-v1",
              },
            },
          }),
        });
      }

      if (url === "/api/monitoring/overview") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            source_state: "degraded",
            monitoring_locations: [],
            predicted_risk_hotspots: [],
            regional_summaries: [],
            top_priority_regions: [],
            data_source_labels: {
              overview: "cached",
            },
            message: "Weather Source unavailable; cached monitoring data shown.",
          }),
        });
      }

      if (url === "/api/alerts/active") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ alerts: [] }),
        });
      }

      if (url === "/api/monitoring/refresh") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ source_state: "degraded", refreshed: [], skipped: [], failed: ["openweather"] }),
        });
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    const settings = await screen.findByRole("dialog", { name: "Settings" });
    expect(within(settings).getByText("Model configuration")).toBeInTheDocument();
    expect(within(settings).getAllByText("Configured")).toHaveLength(3);
    expect(within(settings).getByText("Transfer Limitation")).toBeInTheDocument();
    expect(within(settings).getByText(/Morocco Wildfire Dataset/i)).toBeInTheDocument();
    expect(within(settings).getByText("Weather Source")).toBeInTheDocument();
    expect(within(settings).getByText("Missing")).toBeInTheDocument();
    expect(within(settings).getByText("Mapbox Map Workspace")).toBeInTheDocument();
    expect(within(settings).getByText("Degraded Data Status")).toBeInTheDocument();
    expect(within(settings).getByText(/cached monitoring data shown/i)).toBeInTheDocument();
  });

  it("hides ambient monitoring while the profile menu is open", () => {
    render(<AppShell />);

    expect(screen.getByRole("complementary", { name: "Ambient monitoring" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));

    expect(screen.getByLabelText("Profile menu")).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Ambient monitoring" })).not.toBeInTheDocument();
  });

  it("focuses the map when a location search result is selected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              display_name: "Ankara, Turkiye",
              latitude: 39.9334,
              longitude: 32.8597,
              admin: { province: "Ankara", district: "Cankaya", country: "Turkiye" },
              source_label: "curated-index",
            },
          ],
          message: null,
        }),
      })
    );

    render(<AppShell />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Location search" }), {
      target: { value: "Ankara" },
    });
    fireEvent.click(await screen.findByRole("option", { name: "Ankara, Turkiye" }));

    expect(screen.getByText("Map focus: Ankara, Turkiye")).toBeInTheDocument();
  });

  it("opens a full Wildfire Risk Assessment with API data for the selected location", async () => {
    const location = {
      display_name: "Ankara, Turkiye",
      latitude: 39.9334,
      longitude: 32.8597,
      admin: { province: "Ankara", district: "Cankaya", country: "Turkiye" },
      source_label: "curated-index",
    };
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith("/api/locations/search")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ results: [location], message: null }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          source_state: "live",
          location: {
            name: location.display_name,
            latitude: location.latitude,
            longitude: location.longitude,
            source: location.source_label,
          },
          forecast_assessments: [
            {
              forecast_window: "now",
              risk_level: "high",
              risk_score: 0.74,
              model_confidence: 0.88,
              risk_trend: "rising",
              monitoring_radius: "20 km",
              recommended_action: "Prioritize local inspection",
              narrative_explanation: "Weather conditions favor elevated wildfire risk.",
              narrative_source_label: "fallback",
              model_input_drivers: {
                temperature_c: 36,
                wind_speed_mps: 5,
              },
              weather_signals: {
                humidity_pct: 18,
              },
            },
          ],
          data_source_labels: {
            assessment: "live",
            weather: "live",
            narrative: "fallback",
          },
          message: null,
        }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppShell />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Location search" }), {
      target: { value: "Ankara" },
    });
    fireEvent.click(await screen.findByRole("option", { name: "Ankara, Turkiye" }));
    const locationPanel = screen.getByRole("complementary", { name: "Selected location" });
    expect(await within(locationPanel).findByText("36 C")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Ambient monitoring" })).toBeInTheDocument();
    expect(within(locationPanel).getByText("5 m/s")).toBeInTheDocument();
    expect(within(locationPanel).getByText("18%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Full Assessment" }));

    const decisionSupport = await screen.findByRole("complementary", { name: "Decision support" });
    expect(screen.queryByRole("complementary", { name: "Ambient monitoring" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "High relative wildfire risk" })).toBeInTheDocument();
    expect(screen.getByText("Prioritize local inspection")).toBeInTheDocument();
    expect(screen.getByText("Assessment: Live")).toBeInTheDocument();
    expect(within(locationPanel).getByText("Weather: Live")).toBeInTheDocument();
    expect(screen.getByText("Narrative: Fallback")).toBeInTheDocument();
    expect(within(decisionSupport).getByRole("button", { name: "Weather signals" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/assessments", {
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
          forecast_windows: ["now", "24h", "48h", "72h"],
        }),
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Close decision support" }));
    expect(screen.getByRole("complementary", { name: "Ambient monitoring" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close selected location" }));
    expect(screen.queryByRole("complementary", { name: "Selected location" })).not.toBeInTheDocument();
  });

  it("opens Prediction History and renders grouped assessment records from the API", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/history") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            records: [
              {
                id: "history-1",
                assessment_timestamp: "2026-05-10T10:00:00Z",
                source_state: "live",
                location: {
                  name: "Ankara, Turkiye",
                  latitude: 39.9334,
                  longitude: 32.8597,
                  source: "curated-index",
                },
                requested_forecast_windows: ["now", "24h"],
                data_source_labels: {
                  assessment: "live",
                  weather: "live",
                  narrative: "fallback",
                },
                forecast_assessments: [
                  {
                    forecast_window: "now",
                    risk_level: "high",
                    risk_score: 0.74,
                    recommended_action: "Prioritize local inspection",
                    monitoring_radius: "20 km",
                  },
                ],
              },
            ],
            message: null,
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ alerts: [], regional_summaries: [], monitoring_locations: [], predicted_risk_hotspots: [], top_priority_regions: [] }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Prediction History" }));

    const history = await screen.findByRole("region", { name: "Prediction History" });
    expect(within(history).getByText("Ankara, Turkiye")).toBeInTheDocument();
    const record = within(history).getByRole("article");
    expect(within(record).getByText("High")).toBeInTheDocument();
    expect(within(history).getByText("Prioritize local inspection")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/history");
  });

  it("filters Prediction History by region, date range, and risk level", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/history") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ records: [], message: "No prediction history records found." }),
        });
      }

      if (url === "/api/history?region=Ankara&start_date=2026-05-10&end_date=2026-05-12&risk_level=high") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            records: [
              {
                id: "history-filtered",
                assessment_timestamp: "2026-05-10T10:00:00Z",
                source_state: "live",
                location: {
                  name: "Ankara, Turkiye",
                  latitude: 39.9334,
                  longitude: 32.8597,
                  source: "curated-index",
                },
                requested_forecast_windows: ["now"],
                forecast_assessments: [
                  {
                    forecast_window: "now",
                    risk_level: "high",
                    risk_score: 0.81,
                    recommended_action: "Dispatch field verification",
                    monitoring_radius: "20 km",
                  },
                ],
              },
            ],
            message: null,
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ alerts: [], regional_summaries: [], monitoring_locations: [], predicted_risk_hotspots: [], top_priority_regions: [] }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Prediction History" }));
    const history = await screen.findByRole("region", { name: "Prediction History" });

    fireEvent.change(within(history).getByRole("textbox", { name: "Region" }), {
      target: { value: "Ankara" },
    });
    fireEvent.change(within(history).getByLabelText("Start date"), {
      target: { value: "2026-05-10" },
    });
    fireEvent.change(within(history).getByLabelText("End date"), {
      target: { value: "2026-05-12" },
    });
    fireEvent.change(within(history).getByLabelText("Risk level"), {
      target: { value: "high" },
    });
    fireEvent.click(within(history).getByRole("button", { name: "Apply filters" }));

    expect(await within(history).findByText("Dispatch field verification")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/history?region=Ankara&start_date=2026-05-10&end_date=2026-05-12&risk_level=high"
    );
  });

  it("shows the matching forecast window when filtering Prediction History by risk level", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/history") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ records: [], message: "No prediction history records found." }),
        });
      }

      if (url === "/api/history?risk_level=medium") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            records: [
              {
                id: "history-mixed-risk",
                assessment_timestamp: "2026-06-04T15:26:00Z",
                source_state: "live",
                location: {
                  name: "Ankara, Turkiye",
                  latitude: 39.9334,
                  longitude: 32.8597,
                  source: "curated-index",
                },
                requested_forecast_windows: ["now", "24h"],
                forecast_assessments: [
                  {
                    forecast_window: "now",
                    risk_level: "low",
                    risk_score: 0.21,
                    recommended_action: "Routine monitoring",
                    monitoring_radius: "10 km",
                  },
                  {
                    forecast_window: "24h",
                    risk_level: "medium",
                    risk_score: 0.42,
                    recommended_action: "Increase weather review",
                    monitoring_radius: "15 km",
                  },
                ],
              },
            ],
            message: null,
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ alerts: [], regional_summaries: [], monitoring_locations: [], predicted_risk_hotspots: [], top_priority_regions: [] }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Prediction History" }));
    const history = await screen.findByRole("region", { name: "Prediction History" });

    fireEvent.change(within(history).getByLabelText("Risk level"), {
      target: { value: "medium" },
    });
    fireEvent.click(within(history).getByRole("button", { name: "Apply filters" }));

    const record = await within(history).findByRole("article");
    expect(within(record).getByText("Medium")).toBeInTheDocument();
    expect(within(record).getByText("24h")).toBeInTheDocument();
    expect(within(record).getByText("Increase weather review")).toBeInTheDocument();
    expect(within(record).queryByText("Low")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/history?risk_level=medium");
  });

  it("archives Prediction History records and can show archived records", async () => {
    const activeRecord = {
      id: "history-archive",
      assessment_timestamp: "2026-06-04T15:26:00Z",
      source_state: "live",
      location: {
        name: "Ankara, Turkiye",
        latitude: 39.9334,
        longitude: 32.8597,
        source: "curated-index",
      },
      requested_forecast_windows: ["now"],
      forecast_assessments: [
        {
          forecast_window: "now",
          risk_level: "medium",
          risk_score: 0.42,
          recommended_action: "Increase weather review",
          monitoring_radius: "15 km",
        },
      ],
    };
    const archivedRecord = { ...activeRecord, archived_at: "2026-06-04T16:00:00Z" };
    let isArchived = false;
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/history" && !init) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            records: isArchived ? [] : [activeRecord],
            message: isArchived ? "No prediction history records found." : null,
          }),
        });
      }

      if (url === "/api/history/history-archive/archive" && init?.method === "POST") {
        isArchived = true;
        return Promise.resolve({
          ok: true,
          json: async () => ({ archived_record_id: "history-archive", message: "Prediction history record archived." }),
        });
      }

      if (url === "/api/history?show_archived=true") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ records: [archivedRecord], message: null }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ alerts: [], regional_summaries: [], monitoring_locations: [], predicted_risk_hotspots: [], top_priority_regions: [] }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Prediction History" }));
    const history = await screen.findByRole("region", { name: "Prediction History" });
    expect(await within(history).findByText("Ankara, Turkiye")).toBeInTheDocument();

    fireEvent.click(within(history).getByRole("button", { name: "Archive Ankara, Turkiye" }));

    await waitFor(() => expect(within(history).queryByText("Ankara, Turkiye")).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/history/history-archive/archive", { method: "POST" });

    fireEvent.click(within(history).getByLabelText("Show archived"));

    expect(await within(history).findByText("Ankara, Turkiye")).toBeInTheDocument();
    expect(within(history).getByText("Archived")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/history?show_archived=true");
  });
});
