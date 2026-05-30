import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

vi.mock("mapbox-gl", () => {
  class MockPopup {
    setText() {
      return this;
    }
  }

  class MockMarker {
    setLngLat() {
      return this;
    }
    setPopup() {
      return this;
    }
    addTo() {
      return this;
    }
  }

  class MockMap {
    on(event: string, cb: () => void) {
      if (event === "load") {
        cb();
      }
      return this;
    }
    addControl() {
      return this;
    }
    remove() {
      return this;
    }
  }

  class MockNavigationControl {}

  return {
    default: {
      accessToken: "",
      Map: MockMap,
      Marker: MockMarker,
      Popup: MockPopup,
      NavigationControl: MockNavigationControl,
    },
  };
});

describe("FIREWATCH dashboard shell", () => {
  it("renders key MVP shell surfaces", () => {
    render(<App />);

    expect(screen.getByText("FIREWATCH DSS")).toBeInTheDocument();
    expect(screen.getAllByText("Monitoring Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Prediction History").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Model And Data Status").length).toBeGreaterThan(0);
    expect(screen.getByRole("combobox", { name: "Demo role" })).toBeInTheDocument();
    expect(screen.queryByText("Demo Role Selection")).not.toBeInTheDocument();
  });

  it("hydrates status pills from backend status endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          integrations: {
            openweather: "configured",
          },
          runtime: {
            model_artifact: { state: "configured" },
          },
        }),
      })
    );

    render(<App />);

    expect(await screen.findByText("Weather API: Configured")).toBeInTheDocument();
    expect(await screen.findByText("Model: Configured")).toBeInTheDocument();
  });

  it("lets users switch the dashboard between light and dark themes", () => {
    render(<App />);

    const lightMode = screen.getByRole("button", { name: "Light theme" });
    const darkMode = screen.getByRole("button", { name: "Dark theme" });

    expect(lightMode).toHaveAttribute("aria-pressed", "true");
    expect(darkMode).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(darkMode);

    expect(lightMode).toHaveAttribute("aria-pressed", "false");
    expect(darkMode).toHaveAttribute("aria-pressed", "true");
  });

  it("restores the saved theme preference on the next dashboard visit", () => {
    window.localStorage.setItem("firewatch-theme", "dark");

    render(<App />);

    expect(screen.getByRole("button", { name: "Dark theme" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("creates a live assessment from a selected search result and displays backend decisions", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/status") {
          return {
            ok: true,
            json: async () => ({
              integrations: { openweather: "configured" },
              runtime: { model_artifact: { state: "configured" } },
            }),
          };
        }

        if (url.includes("/api/locations/search?q=Ankara")) {
          return {
            ok: true,
            json: async () => ({
              query: "Ankara",
              results: [
                {
                  display_name: "Ankara, Turkiye",
                  latitude: 39.9334,
                  longitude: 32.8597,
                  admin: {
                    province: "Ankara",
                    district: "Cankaya",
                    country: "Turkiye",
                  },
                  source_label: "curated-index",
                },
              ],
              message: null,
            }),
          };
        }

        if (url === "/api/assessments" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({
              source_state: "live",
              location: {
                name: "Ankara, Turkiye",
                latitude: 39.9334,
                longitude: 32.8597,
                source: "curated-index",
              },
              forecast_assessments: [
                {
                  forecast_window: "now",
                  risk_level: "high",
                  risk_score: 0.74,
                  model_confidence: 0.88,
                  risk_trend: "rising",
                  priority_rank: "P2",
                  monitoring_radius: "20 km",
                  recommended_action: "prioritize local inspection",
                  weather_signals: {
                    humidity_pct: 32,
                    wind_speed_mps: 8,
                    weather_description: "sunny",
                  },
                  narrative_explanation: "Backend grounded briefing.",
                  narrative_source_label: "fallback",
                },
              ],
              data_source_labels: {
                assessment: "live",
                weather: "live",
                narrative: "fallback",
              },
              message: null,
            }),
          };
        }

        return {
          ok: false,
          json: async () => ({}),
        };
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const searchInput = screen.getByRole("searchbox", { name: "Location search" });
    fireEvent.change(searchInput, { target: { value: "Ankara" } });
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));

    fireEvent.click(await screen.findByRole("button", { name: "Ankara, Turkiye" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/assessments",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            location: {
              name: "Ankara, Turkiye",
              latitude: 39.9334,
              longitude: 32.8597,
              source: "curated-index",
            },
            forecast_windows: ["now", "24h", "48h", "72h"],
          }),
        })
      );
    });

    expect(screen.getByText("Selected location: Ankara, Turkiye")).toBeInTheDocument();
    expect(screen.getByText("Map focus: Ankara, Turkiye")).toBeInTheDocument();
    expect(await screen.findByText("Risk level")).toBeInTheDocument();
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);
    expect(screen.getByText("Forecast window")).toBeInTheDocument();
    expect(screen.getByText("Now")).toBeInTheDocument();
    expect(screen.getByText("Model class confidence")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();
    expect(screen.queryByText(/fire probability/i)).not.toBeInTheDocument();
    expect(screen.getByText("Risk trend")).toBeInTheDocument();
    expect(screen.getByText("Rising")).toBeInTheDocument();
    expect(screen.getByText("Priority rank")).toBeInTheDocument();
    expect(screen.getByText("P2")).toBeInTheDocument();
    expect(screen.getByText("prioritize local inspection")).toBeInTheDocument();
    expect(screen.getByText("Backend grounded briefing.")).toBeInTheDocument();
    expect(screen.getByText("Assessment: Live")).toBeInTheDocument();
    expect(screen.getByText("Weather: Live")).toBeInTheDocument();
    expect(screen.getByText("Narrative: Fallback")).toBeInTheDocument();
  });

  it("renders Turkiye monitoring overview from demo monitoring data by default", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/status") {
          return {
            ok: true,
            json: async () => ({
              integrations: { openweather: "configured" },
              runtime: { model_artifact: { state: "configured" } },
            }),
          };
        }

        if (url === "/api/monitoring/overview") {
          return {
            ok: true,
            json: async () => ({
              source_state: "demo",
              data_source_labels: { overview: "demo", hotspots: "demo" },
              monitoring_locations: [
                { name: "Ankara", latitude: 39.9334, longitude: 32.8597 },
                { name: "Izmir", latitude: 38.4237, longitude: 27.1428 },
              ],
              predicted_risk_hotspots: [
                {
                  name: "Mugla Forest Belt",
                  risk_level: "critical",
                  data_source_label: "demo",
                  label: "Simulated overview hotspot",
                },
              ],
              regional_summaries: [{ region: "Aegean", risk_level: "high", data_source_label: "demo" }],
              top_priority_regions: [{ region: "Mugla", priority_rank: "P1", data_source_label: "demo" }],
            }),
          };
        }

        return { ok: false, json: async () => ({}) };
      })
    );

    render(<App />);

    expect(await screen.findByText("Turkiye national monitoring overview")).toBeInTheDocument();
    expect(await screen.findByText(/Mugla Forest Belt/i)).toBeInTheDocument();
    expect(screen.getByText(/simulated overview hotspot/i)).toBeInTheDocument();
    expect(screen.getByText(/overview: demo monitoring data/i)).toBeInTheDocument();
  });

  it("hides model confidence when the backend does not return it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/status") {
          return {
            ok: true,
            json: async () => ({
              integrations: { openweather: "configured" },
              runtime: { model_artifact: { state: "configured" } },
            }),
          };
        }

        if (url.includes("/api/locations/search?q=Antalya")) {
          return {
            ok: true,
            json: async () => ({
              results: [
                {
                  display_name: "Antalya, Turkiye",
                  latitude: 36.8969,
                  longitude: 30.7133,
                  admin: {
                    province: "Antalya",
                    district: "Muratpasa",
                    country: "Turkiye",
                  },
                  source_label: "curated-index",
                },
              ],
              message: null,
            }),
          };
        }

        if (url === "/api/assessments" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({
              source_state: "live",
              forecast_assessments: [
                {
                  forecast_window: "now",
                  risk_level: "high",
                  risk_score: 0.74,
                  model_confidence: null,
                  risk_trend: "rising",
                  priority_rank: "P2",
                  monitoring_radius: "20 km",
                  recommended_action: "prioritize local inspection",
                  weather_signals: {
                    humidity_pct: 32,
                    wind_speed_mps: 8,
                    weather_description: "sunny",
                  },
                  narrative_explanation: "Backend grounded briefing.",
                  narrative_source_label: "fallback",
                },
              ],
              data_source_labels: {
                assessment: "live",
                weather: "live",
                narrative: "fallback",
              },
              message: null,
            }),
          };
        }

        return {
          ok: false,
          json: async () => ({}),
        };
      })
    );

    render(<App />);

    const searchInput = screen.getByRole("searchbox", { name: "Location search" });
    fireEvent.change(searchInput, { target: { value: "Antalya" } });
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));
    fireEvent.click(await screen.findByRole("button", { name: "Antalya, Turkiye" }));

    await screen.findByText("Risk level");
    expect(screen.queryByText("Model class confidence")).not.toBeInTheDocument();
  });

  it("renders all returned forecast assessment windows in the timeline strip", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/status") {
          return {
            ok: true,
            json: async () => ({
              integrations: { openweather: "configured" },
              runtime: { model_artifact: { state: "configured" } },
            }),
          };
        }

        if (url.includes("/api/locations/search?q=Izmir")) {
          return {
            ok: true,
            json: async () => ({
              results: [
                {
                  display_name: "Izmir, Turkiye",
                  latitude: 38.4237,
                  longitude: 27.1428,
                  admin: {
                    province: "Izmir",
                    district: "Konak",
                    country: "Turkiye",
                  },
                  source_label: "curated-index",
                },
              ],
              message: null,
            }),
          };
        }

        if (url === "/api/assessments" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({
              source_state: "live",
              forecast_assessments: [
                {
                  forecast_window: "now",
                  risk_level: "medium",
                  risk_score: 0.52,
                  monitoring_radius: "10 km",
                  recommended_action: "increase weather review",
                },
                {
                  forecast_window: "24h",
                  risk_level: "high",
                  risk_score: 0.74,
                  monitoring_radius: "20 km",
                  recommended_action: "prioritize local inspection",
                },
                {
                  forecast_window: "48h",
                  risk_level: "critical",
                  risk_score: 0.9,
                  monitoring_radius: "30 km",
                  recommended_action: "immediate supervisor review",
                },
                {
                  forecast_window: "72h",
                  risk_level: "low",
                  risk_score: 0.22,
                  monitoring_radius: "5 km",
                  recommended_action: "routine monitoring",
                },
              ],
              data_source_labels: {
                assessment: "live",
                weather: "live",
                narrative: "fallback",
              },
              message: null,
            }),
          };
        }

        return {
          ok: false,
          json: async () => ({}),
        };
      })
    );

    render(<App />);

    const searchInput = screen.getByRole("searchbox", { name: "Location search" });
    fireEvent.change(searchInput, { target: { value: "Izmir" } });
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));
    fireEvent.click(await screen.findByRole("button", { name: "Izmir, Turkiye" }));

    expect(await screen.findByText("Now: Medium")).toBeInTheDocument();
    expect(screen.getByText("24h: High")).toBeInTheDocument();
    expect(screen.getByText("48h: Critical")).toBeInTheDocument();
    expect(screen.getByText("72h: Low")).toBeInTheDocument();
  });

  it("renders active risk alerts in the bottom strip as system-generated risk alerts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/status") {
          return {
            ok: true,
            json: async () => ({
              integrations: { openweather: "configured" },
              runtime: { model_artifact: { state: "configured" } },
            }),
          };
        }

        if (url === "/api/alerts/active") {
          return {
            ok: true,
            json: async () => ({
              alerts: [
                {
                  id: "alert-1",
                  created_at: "2026-05-10T10:00:00Z",
                  expires_at: "2026-05-11T10:00:00Z",
                  status: "active",
                  recommendation_rule_version: "mvp-v1-recommendation-rules",
                  location_name: "Ankara",
                  latitude: 39.9334,
                  longitude: 32.8597,
                  forecast_window: "now",
                  risk_level: "high",
                  risk_score: 0.74,
                  recommended_action: "prioritize local inspection",
                  alert_text:
                    "System-generated risk alert: HIGH relative wildfire risk for Ankara (now). Recommended action: prioritize local inspection.",
                },
              ],
              message: null,
            }),
          };
        }

        return { ok: false, json: async () => ({}) };
      })
    );

    render(<App />);

    expect(await screen.findByText(/System-generated risk alert:/i)).toBeInTheDocument();
    expect(screen.queryByText(/confirmed fire/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/official emergency alert/i)).not.toBeInTheDocument();
  });

  it("renders filtered grouped Prediction History Records with per-window rows", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/status") {
        return {
          ok: true,
          json: async () => ({
            integrations: { openweather: "configured" },
            runtime: { model_artifact: { state: "configured" } },
          }),
        };
      }

      if (url.startsWith("/api/history")) {
        return {
          ok: true,
          json: async () => ({
            records: [
              {
                id: "history-ankara-1",
                assessment_timestamp: "2026-05-10T10:00:00Z",
                source_state: "live",
                location: {
                  name: "Ankara, Turkiye",
                  latitude: 39.9334,
                  longitude: 32.8597,
                  source: "curated-index",
                },
                requested_forecast_windows: ["now", "24h", "48h", "72h"],
                data_source_labels: {
                  assessment: "live",
                  weather: "live",
                  narrative: "fallback",
                },
                forecast_assessments: [
                  {
                    forecast_window: "now",
                    matched_weather_timestamp: "2026-05-10T10:00:00Z",
                    risk_score: 0.74,
                    risk_level: "high",
                    recommended_action: "prioritize local inspection",
                    risk_alert_status: "active",
                    weather_signals: {
                      humidity_pct: 32,
                      weather_description: "sunny",
                    },
                  },
                  {
                    forecast_window: "24h",
                    matched_weather_timestamp: "2026-05-11T10:00:00Z",
                    risk_score: 0.82,
                    risk_level: "critical",
                    recommended_action: "immediate supervisor review",
                    risk_alert_status: "active",
                    weather_signals: {
                      humidity_pct: 27,
                      weather_description: "clear sky",
                    },
                  },
                ],
              },
            ],
            message: null,
          }),
        };
      }

      return { ok: false, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Prediction History" }));
    fireEvent.change(await screen.findByLabelText("History region filter"), {
      target: { value: "Ankara" },
    });
    fireEvent.change(screen.getByLabelText("History start date"), {
      target: { value: "2026-05-10" },
    });
    fireEvent.change(screen.getByLabelText("History end date"), {
      target: { value: "2026-05-10" },
    });
    fireEvent.change(screen.getByLabelText("History risk level"), {
      target: { value: "high" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply history filters" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/history?region=Ankara&start_date=2026-05-10&end_date=2026-05-10&risk_level=high"
      );
    });

    const historyView = await screen.findByLabelText("Prediction History Records");
    expect(within(historyView).getByText("Prediction History Records")).toBeInTheDocument();
    expect(within(historyView).getByText("Ankara, Turkiye")).toBeInTheDocument();
    expect(within(historyView).getByText("Requested windows: Now, 24h, 48h, 72h")).toBeInTheDocument();
    expect(within(historyView).getByText("Now")).toBeInTheDocument();
    expect(within(historyView).getByText("24h")).toBeInTheDocument();
    expect(within(historyView).getByText("Risk score: 0.74")).toBeInTheDocument();
    expect(within(historyView).getByText("Risk level: High")).toBeInTheDocument();
    expect(within(historyView).getByText("Recommended action: prioritize local inspection")).toBeInTheDocument();
    expect(within(historyView).getAllByText("Alert: Active").length).toBeGreaterThan(0);
    expect(within(historyView).getByText("Weather: sunny, Humidity 32%")).toBeInTheDocument();
    expect(within(historyView).getByText("Assessment: Live")).toBeInTheDocument();
    expect(within(historyView).getByText("Weather: Live")).toBeInTheDocument();
    expect(screen.queryByText(/incident history/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/confirmed wildfire incident/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/confirmed fire/i)).not.toBeInTheDocument();
  });

  it("shows an unavailable message when Prediction History cannot be fetched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/status") {
          return {
            ok: true,
            json: async () => ({
              integrations: { openweather: "configured" },
              runtime: { model_artifact: { state: "configured" } },
            }),
          };
        }

        if (url === "/api/history") {
          return {
            ok: false,
            json: async () => ({}),
          };
        }

        return { ok: false, json: async () => ({}) };
      })
    );

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Prediction History" }));

    expect(await screen.findByText("Prediction history is unavailable.")).toBeInTheDocument();
    expect(screen.queryByText("No prediction history records found.")).not.toBeInTheDocument();
  });

  it("separates model input drivers from display-only weather signals", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/status") {
          return {
            ok: true,
            json: async () => ({
              integrations: { openweather: "configured" },
              runtime: { model_artifact: { state: "configured" } },
            }),
          };
        }

        if (url.includes("/api/locations/search?q=Bodrum")) {
          return {
            ok: true,
            json: async () => ({
              results: [
                {
                  display_name: "Bodrum, Mugla, Turkiye",
                  latitude: 37.0344,
                  longitude: 27.4305,
                  admin: {
                    province: "Mugla",
                    district: "Bodrum",
                    country: "Turkiye",
                  },
                  source_label: "curated-index",
                },
              ],
              message: null,
            }),
          };
        }

        if (url === "/api/assessments" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({
              source_state: "live",
              forecast_assessments: [
                {
                  forecast_window: "now",
                  risk_level: "high",
                  risk_score: 0.78,
                  model_confidence: 0.84,
                  risk_trend: "stable",
                  priority_rank: "P2",
                  monitoring_radius: "20 km",
                  recommended_action: "prioritize local inspection",
                  model_input_drivers: {
                    temperature_c: 34,
                    rain_mm: 0,
                    wind_speed_mps: 8,
                  },
                  model_explanation: {
                    label: "Model behavior explanation (not causal proof).",
                    method: "runtime_feature_perturbation_v1",
                    uses_runtime_features_only: true,
                    feature_scope: ["temperature_c", "rain_mm", "wind_speed_mps"],
                    top_feature_impacts: [
                      {
                        feature_name: "temperature_c",
                        feature_value: 34,
                        baseline_value: 27,
                        contribution_to_risk_score: 0.08,
                        direction: "increases_risk",
                      },
                      {
                        feature_name: "wind_speed_mps",
                        feature_value: 8,
                        baseline_value: 4,
                        contribution_to_risk_score: 0.03,
                        direction: "increases_risk",
                      },
                      {
                        feature_name: "rain_mm",
                        feature_value: 0,
                        baseline_value: 0.2,
                        contribution_to_risk_score: -0.02,
                        direction: "decreases_risk",
                      },
                    ],
                    limitations: [
                      "Explanation describes model behavior on this feature vector, not proven real-world wildfire causality.",
                    ],
                  },
                  weather_signals: {
                    humidity_pct: 29,
                    pressure_hpa: 1004,
                    weather_description: "clear sky",
                  },
                  narrative_explanation: "Keep local teams aware of dry windy conditions.",
                  narrative_source_label: "live",
                },
              ],
              data_source_labels: {
                assessment: "live",
                weather: "live",
                narrative: "live",
              },
              message: null,
            }),
          };
        }

        return {
          ok: false,
          json: async () => ({}),
        };
      })
    );

    render(<App />);

    const searchInput = screen.getByRole("searchbox", { name: "Location search" });
    fireEvent.change(searchInput, { target: { value: "Bodrum" } });
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));
    fireEvent.click(await screen.findByRole("button", { name: "Bodrum, Mugla, Turkiye" }));

    const modelInputs = await screen.findByRole("group", { name: "Model input drivers" });
    expect(within(modelInputs).getByText("Temperature")).toBeInTheDocument();
    expect(within(modelInputs).getByText("34 C")).toBeInTheDocument();
    expect(within(modelInputs).getByText("Rainfall")).toBeInTheDocument();
    expect(within(modelInputs).getByText("0 mm")).toBeInTheDocument();
    expect(within(modelInputs).queryByText("Humidity")).not.toBeInTheDocument();

    const explanationGroup = screen.getByRole("group", { name: "Model behavior explanation" });
    expect(explanationGroup).toBeInTheDocument();
    expect(within(explanationGroup).getByText("Model behavior explanation (not causal proof).")).toBeInTheDocument();
    expect(within(explanationGroup).getByText("Temperature")).toBeInTheDocument();
    expect(within(explanationGroup).getByText("increases risk (delta 0.080)")).toBeInTheDocument();
    expect(within(explanationGroup).getByText("Wind speed")).toBeInTheDocument();
    expect(within(explanationGroup).getByText("increases risk (delta 0.030)")).toBeInTheDocument();
    expect(within(explanationGroup).getByText("Rainfall")).toBeInTheDocument();
    expect(within(explanationGroup).getByText("decreases risk (delta -0.020)")).toBeInTheDocument();
    expect(within(explanationGroup).getByText(/not proven real-world wildfire causality/i)).toBeInTheDocument();

    const weatherSignals = screen.getByRole("group", { name: "Display-only weather signals" });
    expect(within(weatherSignals).getByText("Humidity")).toBeInTheDocument();
    expect(within(weatherSignals).getByText("29%")).toBeInTheDocument();
    expect(within(weatherSignals).getByText("Pressure")).toBeInTheDocument();
    expect(within(weatherSignals).getByText("1004 hPa")).toBeInTheDocument();
  });

  it("adjusts demo role emphasis without hiding assessment facts or implying access control", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/status") {
          return {
            ok: true,
            json: async () => ({
              integrations: { openweather: "configured" },
              runtime: { model_artifact: { state: "configured" } },
            }),
          };
        }

        if (url.includes("/api/locations/search?q=Izmir")) {
          return {
            ok: true,
            json: async () => ({
              results: [
                {
                  display_name: "Izmir, Turkiye",
                  latitude: 38.4237,
                  longitude: 27.1428,
                  admin: {
                    province: "Izmir",
                    district: "Konak",
                    country: "Turkiye",
                  },
                  source_label: "curated-index",
                },
              ],
              message: null,
            }),
          };
        }

        if (url === "/api/assessments" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({
              source_state: "live",
              forecast_assessments: [
                {
                  forecast_window: "now",
                  risk_level: "critical",
                  risk_score: 0.91,
                  model_confidence: 0.9,
                  risk_trend: "rising",
                  priority_rank: "P1",
                  monitoring_radius: "30 km",
                  recommended_action: "immediate supervisor review",
                  narrative_explanation: "Critical relative wildfire risk for Izmir.",
                  narrative_source_label: "fallback",
                },
              ],
              data_source_labels: {
                assessment: "live",
                weather: "live",
                narrative: "fallback",
              },
              message: null,
            }),
          };
        }

        return {
          ok: false,
          json: async () => ({}),
        };
      })
    );

    render(<App />);

    const searchInput = screen.getByRole("searchbox", { name: "Location search" });
    fireEvent.change(searchInput, { target: { value: "Izmir" } });
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));
    fireEvent.click(await screen.findByRole("button", { name: "Izmir, Turkiye" }));

    expect(await screen.findByText("Local monitoring emphasis")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Demo role" }), {
      target: { value: "Disaster Management Official" },
    });

    expect(screen.getByText("Coordination emphasis")).toBeInTheDocument();
    expect(screen.getAllByText("Critical").length).toBeGreaterThan(0);
    expect(screen.getByText("0.91")).toBeInTheDocument();
    expect(screen.getByText("immediate supervisor review")).toBeInTheDocument();
    expect(screen.queryByText(/permission|access granted|restricted/i)).not.toBeInTheDocument();
  });

  it("shows loading and degraded OpenWeather labels when assessment creation is blocked", async () => {
    let resolveAssessment:
      | ((value: { ok: boolean; json: () => Promise<Record<string, unknown>> }) => void)
      | undefined;
    const assessmentResponse = new Promise<{ ok: boolean; json: () => Promise<Record<string, unknown>> }>(
      (resolve) => {
        resolveAssessment = resolve;
      }
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/status") {
          return {
            ok: true,
            json: async () => ({
              integrations: { openweather: "configured" },
              runtime: { model_artifact: { state: "configured" } },
            }),
          };
        }

        if (url.includes("/api/locations/search?q=Mugla")) {
          return {
            ok: true,
            json: async () => ({
              results: [
                {
                  display_name: "Mugla, Turkiye",
                  latitude: 37.2153,
                  longitude: 28.3636,
                  admin: {
                    province: "Mugla",
                    district: "Mentese",
                    country: "Turkiye",
                  },
                  source_label: "curated-index",
                },
              ],
              message: null,
            }),
          };
        }

        if (url === "/api/assessments" && init?.method === "POST") {
          return assessmentResponse;
        }

        return {
          ok: false,
          json: async () => ({}),
        };
      })
    );

    render(<App />);

    const searchInput = screen.getByRole("searchbox", { name: "Location search" });
    fireEvent.change(searchInput, { target: { value: "Mugla" } });
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mugla, Turkiye" }));

    expect(await screen.findByText("Creating live assessment...")).toBeInTheDocument();

    resolveAssessment?.({
      ok: true,
      json: async () => ({
        source_state: "degraded",
        forecast_assessments: [],
        data_source_labels: {
          assessment: "unavailable",
          weather: "unavailable",
          narrative: "unavailable",
        },
        message: "OpenWeather request failed; weather source is degraded.",
      }),
    });

    expect(
      await screen.findByText("OpenWeather request failed; weather source is degraded.")
    ).toBeInTheDocument();
    expect(screen.getByText("Degraded")).toBeInTheDocument();
    expect(screen.getByText("Assessment: Unavailable")).toBeInTheDocument();
    expect(screen.getByText("Weather: Unavailable")).toBeInTheDocument();
    expect(screen.getByText("Narrative: Unavailable")).toBeInTheDocument();
    expect(screen.getByText("Assessment unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Awaiting location")).not.toBeInTheDocument();
  });

  it("shows model unavailable messages without replacing them with client-computed risk", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/status") {
          return {
            ok: true,
            json: async () => ({
              integrations: { openweather: "configured" },
              runtime: { model_artifact: { state: "configured" } },
            }),
          };
        }

        if (url.includes("/api/locations/search?q=Antalya")) {
          return {
            ok: true,
            json: async () => ({
              results: [
                {
                  display_name: "Antalya, Turkiye",
                  latitude: 36.8969,
                  longitude: 30.7133,
                  admin: {
                    province: "Antalya",
                    district: "Muratpasa",
                    country: "Turkiye",
                  },
                  source_label: "curated-index",
                },
              ],
              message: null,
            }),
          };
        }

        if (url === "/api/assessments" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({
              source_state: "degraded",
              forecast_assessments: [],
              data_source_labels: {
                assessment: "unavailable",
                weather: "live",
                narrative: "unavailable",
              },
              message: "Model unavailable; assessment cannot be generated.",
            }),
          };
        }

        return {
          ok: false,
          json: async () => ({}),
        };
      })
    );

    render(<App />);

    const searchInput = screen.getByRole("searchbox", { name: "Location search" });
    fireEvent.change(searchInput, { target: { value: "Antalya" } });
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));
    fireEvent.click(await screen.findByRole("button", { name: "Antalya, Turkiye" }));

    expect(
      await screen.findByText("Model unavailable; assessment cannot be generated.")
    ).toBeInTheDocument();
    expect(screen.getByText("Risk score")).toBeInTheDocument();
    expect(screen.getAllByText("Not available").length).toBeGreaterThan(0);
    expect(screen.getByText("Weather: Live")).toBeInTheDocument();
  });

  it("shows a clear no-result message for unresolved search text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/status") {
          return {
            ok: true,
            json: async () => ({
              integrations: { openweather: "configured" },
              runtime: { model_artifact: { state: "configured" } },
            }),
          };
        }

        if (url.includes("/api/locations/search?q=UnknownPlace")) {
          return {
            ok: true,
            json: async () => ({
              query: "UnknownPlace",
              results: [],
              message: "No location search results found.",
            }),
          };
        }

        return {
          ok: false,
          json: async () => ({}),
        };
      })
    );

    render(<App />);

    const searchInput = screen.getByRole("searchbox", { name: "Location search" });
    fireEvent.change(searchInput, { target: { value: "UnknownPlace" } });
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));

    expect(await screen.findByText("No location search results found.")).toBeInTheDocument();
    expect(screen.getByText("Selected location: None")).toBeInTheDocument();
  });

  it("renders compact data layer semantics with prediction input and context sections", () => {
    render(<App />);

    const layersPanel = screen.getByLabelText("Data Layers");
    expect(within(layersPanel).getByText("Prediction Inputs")).toBeInTheDocument();
    expect(within(layersPanel).getByText("Context Layers")).toBeInTheDocument();
    expect(within(layersPanel).getAllByText(/State: Active|State: Inactive/i).length).toBeGreaterThan(0);
    expect(within(layersPanel).getAllByText(/Source:/i).length).toBeGreaterThan(0);
    expect(within(layersPanel).getAllByText(/Unavailable|Demo/i).length).toBeGreaterThan(0);
    expect(
      within(layersPanel).getByLabelText(/Model-linked prediction input: active/i)
    ).toBeInTheDocument();
    expect(
      within(layersPanel).getAllByText(/Model-linked \(not display toggle\)/i).length
    ).toBeGreaterThan(0);
  });

  it("keeps backend assessment facts unchanged when display-only context layers are toggled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/status") {
          return {
            ok: true,
            json: async () => ({
              integrations: { openweather: "configured" },
              runtime: { model_artifact: { state: "configured" } },
            }),
          };
        }

        if (url.includes("/api/locations/search?q=Ankara")) {
          return {
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
          };
        }

        if (url === "/api/assessments" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({
              source_state: "live",
              forecast_assessments: [
                {
                  forecast_window: "now",
                  risk_level: "high",
                  risk_score: 0.74,
                  recommended_action: "prioritize local inspection",
                  weather_signals: {
                    humidity_pct: 32,
                    weather_description: "sunny",
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
          };
        }

        return { ok: false, json: async () => ({}) };
      })
    );

    render(<App />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Location search" }), {
      target: { value: "Ankara" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ankara, Turkiye" }));

    expect(await screen.findByText("Risk score")).toBeInTheDocument();
    expect(screen.getByText("0.74")).toBeInTheDocument();
    expect(screen.getByText("Risk level")).toBeInTheDocument();
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);
    expect(screen.getByText("prioritize local inspection")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /Weather signals context/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Predicted hotspots context/i }));

    expect(screen.getByText("0.74")).toBeInTheDocument();
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);
    expect(screen.getByText("prioritize local inspection")).toBeInTheDocument();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});
