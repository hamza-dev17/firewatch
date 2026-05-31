import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MapSearch } from "./MapSearch";

const ankara = {
  display_name: "Ankara, Turkiye",
  latitude: 39.9334,
  longitude: 32.8597,
  admin: {
    province: "Ankara",
    district: "Cankaya",
    country: "Turkiye",
  },
  source_label: "curated-index",
};

describe("MapSearch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("queries location search as the user types and shows resolved locations", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [ankara], message: null }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MapSearch onSelectLocation={vi.fn()} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Location search" }), {
      target: { value: "Ankara" },
    });

    expect(await screen.findByRole("option", { name: "Ankara, Turkiye" })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/locations/search?q=Ankara"));
  });

  it("selects a highlighted result with keyboard navigation", async () => {
    const izmir = {
      ...ankara,
      display_name: "Izmir, Turkiye",
      latitude: 38.4237,
      longitude: 27.1428,
      admin: { ...ankara.admin, province: "Izmir", district: "Konak" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [ankara, izmir], message: null }),
      })
    );
    const onSelectLocation = vi.fn();

    render(<MapSearch onSelectLocation={onSelectLocation} />);

    const input = screen.getByRole("searchbox", { name: "Location search" });
    fireEvent.change(input, { target: { value: "i" } });
    await screen.findByRole("option", { name: "Izmir, Turkiye" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelectLocation).toHaveBeenCalledWith(izmir);
  });
});
