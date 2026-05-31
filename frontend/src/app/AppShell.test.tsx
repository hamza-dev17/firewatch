import { fireEvent, render, screen } from "@testing-library/react";
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
});
