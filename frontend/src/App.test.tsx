import { fireEvent, render, screen } from "@testing-library/react";
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
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});
