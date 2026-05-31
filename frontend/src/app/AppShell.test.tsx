import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./MapCanvas", () => ({
  MapCanvas: ({ selectedLocation }: { selectedLocation?: { display_name: string } | null }) => (
    <section aria-label="Türkiye monitoring map">
      {selectedLocation ? `Map focus: ${selectedLocation.display_name}` : null}
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

  it("starts dark and persists the selected theme", () => {
    render(<AppShell />);

    const shell = screen.getByTestId("app-shell");
    const lightMode = screen.getByRole("button", { name: "Light theme" });
    expect(shell).toHaveAttribute("data-theme", "dark");

    fireEvent.click(lightMode);

    expect(shell).toHaveAttribute("data-theme", "light");
    expect(window.localStorage.getItem("firewatch-theme")).toBe("light");
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
    expect(within(locationPanel).getByText("5 m/s")).toBeInTheDocument();
    expect(within(locationPanel).getByText("18%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Full Assessment" }));

    const decisionSupport = await screen.findByRole("complementary", { name: "Decision support" });
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
  });
});
