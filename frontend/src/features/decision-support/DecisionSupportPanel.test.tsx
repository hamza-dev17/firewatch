import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AssessmentPayload, LocationSearchResult } from "../../dashboard/types";
import { DecisionSupportPanel } from "./DecisionSupportPanel";

const location: LocationSearchResult = {
  display_name: "Ankara, Turkiye",
  latitude: 39.9334,
  longitude: 32.8597,
  admin: { province: "Ankara", district: "Cankaya", country: "Turkiye" },
  source_label: "curated-index",
};

const assessmentPayload: AssessmentPayload = {
  source_state: "live",
  forecast_assessments: [
    {
      forecast_window: "now",
      risk_level: "high",
      risk_score: 0.74,
      model_confidence: 0.88,
      risk_trend: "rising",
      monitoring_radius: "20 km",
      recommended_action: "Prioritize local inspection",
      model_input_drivers: { temperature_c: 36, wind_speed_mps: 5, rain_mm: 0 },
      weather_signals: { humidity_pct: 18, pressure_hpa: 1008 },
      narrative_explanation:
        "**Operational Briefing:** Wildfire Risk Monitoring **Location:** Ankara, Turkiye **Forecast Window:** now **Humidity:** 18% - **Pressure:** 1008 hPa - **Risk Assessment:** High **Recommended Action:** Prioritize local inspection **Monitoring Radius:** 20 km **Data Source:** Live Open-Meteo",
    },
    {
      forecast_window: "24h",
      risk_level: "critical",
      risk_score: 0.86,
      monitoring_radius: "30 km",
      recommended_action: "Escalate monitoring",
      model_input_drivers: { temperature_c: 38, wind_speed_mps: 7, rain_mm: 0 },
      weather_signals: { humidity_pct: 14, pressure_hpa: 1004 },
    },
    {
      forecast_window: "48h",
      risk_level: "medium",
      risk_score: 0.55,
      monitoring_radius: "15 km",
      recommended_action: "Maintain monitoring",
      model_input_drivers: { temperature_c: 32, wind_speed_mps: 3, rain_mm: 1 },
      weather_signals: { humidity_pct: 28, pressure_hpa: 1012 },
    },
    {
      forecast_window: "72h",
      risk_level: "low",
      risk_score: 0.22,
      monitoring_radius: "10 km",
      recommended_action: "Routine monitoring",
      model_input_drivers: { temperature_c: 26, wind_speed_mps: 2, rain_mm: 3 },
      weather_signals: { humidity_pct: 44, pressure_hpa: 1016 },
    },
  ],
  data_source_labels: {
    assessment: "live",
    weather: "live",
    narrative: "fallback",
  },
};

describe("DecisionSupportPanel", () => {
  it("shows the relative wildfire risk for each forecast window", () => {
    render(
      <DecisionSupportPanel
        assessmentPayload={assessmentPayload}
        isAssessing={false}
        location={location}
        onClose={vi.fn()}
      />
    );

    const forecastStrip = screen.getByRole("group", { name: "Forecast windows" });
    expect(forecastStrip).toHaveTextContent("Now");
    expect(forecastStrip).toHaveTextContent("24h");
    expect(forecastStrip).toHaveTextContent("48h");
    expect(forecastStrip).toHaveTextContent("72h");
    expect(forecastStrip).toHaveTextContent("High");
    expect(forecastStrip).toHaveTextContent("Critical");
    expect(forecastStrip).toHaveTextContent("Medium");
    expect(forecastStrip).toHaveTextContent("Low");
  });

  it("shows the selected forecast weather observation with its source label", () => {
    render(
      <DecisionSupportPanel
        assessmentPayload={assessmentPayload}
        isAssessing={false}
        location={location}
        onClose={vi.fn()}
      />
    );

    const weatherGrid = screen.getByRole("group", { name: "Weather observation" });
    expect(within(weatherGrid).getByText("36 C")).toBeInTheDocument();
    expect(within(weatherGrid).getByText("18%")).toBeInTheDocument();
    expect(within(weatherGrid).getByText("5 m/s")).toBeInTheDocument();
    expect(within(weatherGrid).getByText("0 mm")).toBeInTheDocument();
    expect(screen.getByText("Weather: Live")).toBeInTheDocument();
  });

  it("expands weather signals and model dataset details on demand", () => {
    render(
      <DecisionSupportPanel
        assessmentPayload={assessmentPayload}
        isAssessing={false}
        location={location}
        onClose={vi.fn()}
      />
    );

    const weatherToggle = screen.getByRole("button", { name: "Weather signals" });
    expect(weatherToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "Weather signals" })).not.toBeInTheDocument();
    fireEvent.click(weatherToggle);
    const weatherSignals = screen.getByRole("region", { name: "Weather signals" });
    expect(weatherToggle).toHaveAttribute("aria-expanded", "true");
    expect(within(weatherSignals).getByText("1008 hPa")).toBeInTheDocument();

    const modelToggle = screen.getByRole("button", { name: "Model & dataset" });
    expect(modelToggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(modelToggle);
    const modelDataset = screen.getByRole("region", { name: "Model & dataset" });
    expect(modelToggle).toHaveAttribute("aria-expanded", "true");
    expect(within(modelDataset).getByText("Runtime features used for this Prototype Relative Wildfire Risk assessment.")).toBeInTheDocument();
    expect(within(modelDataset).getByText(/Transfer limitation:/)).toBeInTheDocument();
  });

  it("turns markdown-style operational briefing facts into operator-readable copy", () => {
    const { container } = render(
      <DecisionSupportPanel
        assessmentPayload={assessmentPayload}
        isAssessing={false}
        location={location}
        onClose={vi.fn()}
      />
    );

    const briefing = screen.getByText("Operational briefing").closest("section");
    expect(briefing).not.toBeNull();

    expect(within(briefing as HTMLElement).getByText("High relative wildfire risk is reported for Ankara, Turkiye in the now forecast window.")).toBeInTheDocument();
    expect(within(briefing as HTMLElement).getByText("Current conditions: temperature is 36 C, humidity is 18%, wind is 5 m/s, no rain is recorded.")).toBeInTheDocument();
    expect(within(briefing as HTMLElement).getByText("Recommended action: Prioritize local inspection. Monitor within the 20 km advisory radius.")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("**");
    expect(briefing).not.toHaveTextContent("1008 hPa");
  });

  it("updates the displayed assessment when a different forecast window is clicked", () => {
    render(
      <DecisionSupportPanel
        assessmentPayload={assessmentPayload}
        isAssessing={false}
        location={location}
        onClose={vi.fn()}
      />
    );

    // Initial state (Now)
    const weatherGrid = screen.getByRole("group", { name: "Weather observation" });
    expect(within(weatherGrid).getByText("36 C")).toBeInTheDocument();
    expect(within(weatherGrid).getByText("18%")).toBeInTheDocument();

    // Click on 24h
    const forecastStrip = screen.getByRole("group", { name: "Forecast windows" });
    const button24h = within(forecastStrip).getByRole("button", { name: /24h/i });
    fireEvent.click(button24h);

    // Assert the displayed weather changes to 24h values
    expect(within(weatherGrid).getByText("38 C")).toBeInTheDocument();
    expect(within(weatherGrid).getByText("14%")).toBeInTheDocument();

    // The hero block should update to critical
    expect(screen.getByText("Critical relative wildfire risk")).toBeInTheDocument();
  });
});
