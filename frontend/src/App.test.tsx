import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./app/MapCanvas", () => ({
  MapCanvas: () => <section aria-label="Türkiye monitoring map" />,
}));

import App from "./App";

describe("FIREWATCH application", () => {
  it("renders the map-first dashboard shell", () => {
    render(<App />);

    expect(screen.getByLabelText("FIREWATCH")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Türkiye monitoring map" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Operational status" })).toBeInTheDocument();
  });
});
