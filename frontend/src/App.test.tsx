import { fireEvent, render, screen } from "@testing-library/react";
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

  it("opens the operator profile modal", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open operator profile" }));

    const dialog = screen.getByRole("dialog", { name: "Operator profile settings" });
    expect(dialog).toBeInTheDocument();

    // Sidebar identity
    expect(screen.getByText("Hamza Karakus")).toBeInTheDocument();

    // Tab navigation works
    fireEvent.click(screen.getByRole("button", { name: /assignment/i }));
    expect(screen.getByText(/operational assignment/i)).toBeInTheDocument();

    // Footer actions exist
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });
});
