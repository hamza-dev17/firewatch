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

  it("lets users search and select a location result in visible dashboard state", async () => {
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

        return {
          ok: false,
          json: async () => ({}),
        };
      })
    );

    render(<App />);

    const searchInput = screen.getByRole("searchbox", { name: "Location search" });
    fireEvent.change(searchInput, { target: { value: "Ankara" } });
    fireEvent.click(screen.getByRole("button", { name: "Search locations" }));

    fireEvent.click(await screen.findByRole("button", { name: "Ankara, Turkiye" }));

    expect(screen.getByText("Selected location: Ankara, Turkiye")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ankara, Turkiye" })).toBeInTheDocument();
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
