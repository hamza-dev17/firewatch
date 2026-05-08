import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

describe("FIREWATCH dashboard shell", () => {
  it("renders key MVP shell surfaces", () => {
    render(<App />);

    expect(screen.getByText("FIREWATCH DSS")).toBeInTheDocument();
    expect(screen.getAllByText("Monitoring Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Prediction History").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Model And Data Status").length).toBeGreaterThan(0);
    expect(screen.getByText("Demo Role Selection")).toBeInTheDocument();
    expect(
      screen.getByText(/Presentation emphasis only\. No authentication or access control\./i)
    ).toBeInTheDocument();
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
});

afterEach(() => {
  vi.unstubAllGlobals();
});
