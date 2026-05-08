import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});
