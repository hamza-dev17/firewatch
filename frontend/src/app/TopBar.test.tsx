import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TopBar } from "./TopBar";
import { OPERATOR_PROFILE_STORAGE_KEY } from "../features/settings/operatorProfile";

describe("TopBar", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  const renderTopBar = (onSettingsOpen = vi.fn()) =>
    render(<TopBar themeMode="dark" onThemeModeChange={vi.fn()} onSettingsOpen={onSettingsOpen} />);

  it("renders the FIREWATCH logo and profile avatar", () => {
    renderTopBar();

    expect(screen.getByLabelText("FIREWATCH")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open operator profile" })).toBeInTheDocument();
  });

  it("opens the profile modal on avatar click", () => {
    renderTopBar();

    fireEvent.click(screen.getByRole("button", { name: "Open operator profile" }));

    expect(screen.getByRole("dialog", { name: "Operator profile settings" })).toBeInTheDocument();
    // "Account" appears in sidebar nav and title — just verify the modal opened
    expect(screen.getAllByText("Account").length).toBeGreaterThan(0);
  });

  it("closes the profile modal on Escape", () => {
    renderTopBar();
    fireEvent.click(screen.getByRole("button", { name: "Open operator profile" }));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Operator profile settings" })).not.toBeInTheDocument();
  });

  it("closes the profile modal via the Cancel button", () => {
    renderTopBar();
    fireEvent.click(screen.getByRole("button", { name: "Open operator profile" }));

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("dialog", { name: "Operator profile settings" })).not.toBeInTheDocument();
  });

  it("allows switching tabs inside the profile modal", () => {
    renderTopBar();
    fireEvent.click(screen.getByRole("button", { name: "Open operator profile" }));

    fireEvent.click(screen.getByRole("button", { name: /assignment/i }));
    // Assignment tab shows the operator's region — unique enough
    expect(screen.getByText(/operational assignment/i)).toBeInTheDocument();
  });

  it("opens settings from the top bar action", () => {
    const onSettingsOpen = vi.fn();
    renderTopBar(onSettingsOpen);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(onSettingsOpen).toHaveBeenCalledTimes(1);
  });

  it("saves profile changes and uses them after reopening", () => {
    const { unmount } = renderTopBar();
    fireEvent.click(screen.getByRole("button", { name: "Open operator profile" }));

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Hakan Kaya" } });
    fireEvent.change(screen.getByLabelText(/badge/i), { target: { value: "OGM-9001" } });
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: "hakan.kaya@ogm.gov.tr" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(window.localStorage.getItem(OPERATOR_PROFILE_STORAGE_KEY)).toContain("Hakan Kaya");

    unmount();
    renderTopBar();
    fireEvent.click(screen.getByRole("button", { name: "Open operator profile" }));

    expect(screen.getByDisplayValue("Hakan Kaya")).toBeInTheDocument();
    expect(screen.getByDisplayValue("OGM-9001")).toBeInTheDocument();
    expect(screen.getByDisplayValue("hakan.kaya@ogm.gov.tr")).toBeInTheDocument();
    expect(screen.getAllByText("HK").length).toBeGreaterThan(0);
  });
});
