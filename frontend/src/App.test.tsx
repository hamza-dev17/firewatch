import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

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
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});
