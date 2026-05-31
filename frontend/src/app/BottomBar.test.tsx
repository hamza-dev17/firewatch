import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BottomBar } from "./BottomBar";

describe("BottomBar", () => {
  it("renders persistent operational status", () => {
    render(<BottomBar activeAlertCount={0} selectedCity={null} />);

    expect(screen.getByRole("status", { name: "Operational status" })).toHaveTextContent(
      "FIREWATCH"
    );
    expect(screen.getByText("MODEL ONLINE")).toBeInTheDocument();
    expect(screen.getByText("LAST REFRESH LIVE")).toBeInTheDocument();
    expect(screen.getByText("NO LOCATION SELECTED")).toBeInTheDocument();
    expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeInTheDocument();
  });

  it("shows the live active risk-alert count", () => {
    render(<BottomBar activeAlertCount={4} selectedCity={null} />);

    expect(screen.getByText("ALERTS 4")).toBeInTheDocument();
  });
});
