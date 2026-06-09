import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
        "High relative wildfire risk is elevated in the now forecast window because the runtime prediction inputs show hot, dry, windy conditions with no rainfall input. Humidity is a display-only weather signal that supports the field context, but it is not listed as a model input here. Use the approved recommended action, Prioritize local inspection, within the 20 km monitoring radius.",
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

  it("displays driver-focused operational briefing copy without duplicating the weather grid", () => {
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

    expect(within(briefing as HTMLElement).getByText("High relative wildfire risk is elevated in the now forecast window because the runtime prediction inputs show hot, dry, windy conditions with no rainfall input.")).toBeInTheDocument();
    expect(within(briefing as HTMLElement).getByText("Humidity is a display-only weather signal that supports the field context, but it is not listed as a model input here.")).toBeInTheDocument();
    expect(within(briefing as HTMLElement).getByText("Use the approved recommended action, Prioritize local inspection, within the 20 km monitoring radius.")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("**");
    expect(briefing).not.toHaveTextContent("1008 hPa");
    expect(briefing).not.toHaveTextContent("temperature is 36 C");
  });

  it("keeps fallback briefing useful and source-labeled", () => {
    render(
      <DecisionSupportPanel
        assessmentPayload={assessmentPayload}
        isAssessing={false}
        location={location}
        onClose={vi.fn()}
      />
    );

    const briefing = screen.getByText("Operational briefing").closest("section");
    expect(briefing).not.toBeNull();
    expect(within(briefing as HTMLElement).getByText(/runtime prediction inputs show hot, dry, windy conditions/)).toBeInTheDocument();
    expect(within(briefing as HTMLElement).getByText(/display-only weather signal/)).toBeInTheDocument();
    expect(screen.getByText("Narrative: Fallback")).toBeInTheDocument();
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

  it("asks bounded assistant questions for the selected Forecast Window and clears answers when context changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        answer:
          "The main model input drivers available for Ankara, Turkiye in the now Forecast Window are temperature 36 C, wind speed 5 m/s, rainfall 0 mm.",
        answer_source_label: "live-groq",
        answer_source_state: "live",
        supported_question: true,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DecisionSupportPanel
        assessmentPayload={assessmentPayload}
        isAssessing={false}
        location={location}
        onClose={vi.fn()}
      />
    );

    const assistant = screen.getByRole("region", { name: "Ask about this assessment" });
    expect(within(assistant).getByText("Now Forecast Window")).toBeInTheDocument();
    fireEvent.click(within(assistant).getByRole("button", { name: "What factors matter most?" }));

    expect(await within(assistant).findByText(/temperature 36 C/)).toBeInTheDocument();
    expect(within(assistant).getByText("Assistant: Live Groq")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/assessment-assistant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "What factors matter most?",
        location_name: location.display_name,
        forecast_window: "now",
        assessment: assessmentPayload.forecast_assessments?.[0],
        forecast_assessments: assessmentPayload.forecast_assessments,
        data_source_labels: assessmentPayload.data_source_labels,
      }),
    });

    const forecastStrip = screen.getByRole("group", { name: "Forecast windows" });
    fireEvent.click(within(forecastStrip).getByRole("button", { name: /24h/i }));

    await waitFor(() => {
      expect(within(assistant).getByText("24h Forecast Window")).toBeInTheDocument();
      expect(within(assistant).queryByText(/temperature 36 C/)).not.toBeInTheDocument();
    });
    expect(within(assistant).getByText("Answers are limited to this selected Wildfire Risk Assessment and Forecast Window.")).toBeInTheDocument();
  });

  it("does not show fallback provenance before an assistant answer exists", () => {
    render(
      <DecisionSupportPanel
        assessmentPayload={assessmentPayload}
        isAssessing={false}
        location={location}
        onClose={vi.fn()}
      />
    );

    const assistant = screen.getByRole("region", { name: "Ask about this assessment" });
    expect(within(assistant).getByText("Assistant: Ready")).toBeInTheDocument();
    expect(within(assistant).queryByText("Assistant: Bounded Fallback")).not.toBeInTheDocument();
  });

  it("sends available Forecast Windows when asking for a comparison answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        answer:
          "Now to 24h comparison for Ankara, Turkiye: Risk Trend changes from stable to rising. Prediction Inputs show temperature is hotter by 2 C.",
        answer_source_label: "bounded-fallback",
        supported_question: true,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DecisionSupportPanel
        assessmentPayload={assessmentPayload}
        isAssessing={false}
        location={location}
        onClose={vi.fn()}
      />
    );

    const forecastStrip = screen.getByRole("group", { name: "Forecast windows" });
    fireEvent.click(within(forecastStrip).getByRole("button", { name: /24h/i }));

    const assistant = screen.getByRole("region", { name: "Ask about this assessment" });
    fireEvent.click(within(assistant).getByRole("button", { name: "Why did risk increase?" }));

    expect(await within(assistant).findByText(/Now to 24h comparison/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/assessment-assistant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Why did risk increase?",
        location_name: location.display_name,
        forecast_window: "24h",
        assessment: assessmentPayload.forecast_assessments?.[1],
        forecast_assessments: assessmentPayload.forecast_assessments,
        data_source_labels: assessmentPayload.data_source_labels,
      }),
    });
  });

  it("shows unavailable comparison answers returned by the bounded assistant", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        answer:
          "Forecast Window comparison is unavailable because the required Forecast Window set is missing from the approved assessment facts.",
        answer_source_label: "unavailable",
        answer_source_state: "unavailable",
        supported_question: false,
      }),
    }));

    render(
      <DecisionSupportPanel
        assessmentPayload={{ ...assessmentPayload, forecast_assessments: [assessmentPayload.forecast_assessments![0]] }}
        isAssessing={false}
        location={location}
        onClose={vi.fn()}
      />
    );

    const assistant = screen.getByRole("region", { name: "Ask about this assessment" });
    fireEvent.click(within(assistant).getByRole("button", { name: "Why did risk increase?" }));

    expect(await within(assistant).findByText(/comparison is unavailable/)).toBeInTheDocument();
    expect(within(assistant).getByText("Assistant: Unavailable")).toBeInTheDocument();
  });
});
