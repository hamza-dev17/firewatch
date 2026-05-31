import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TopBar } from "./TopBar";

describe("TopBar", () => {
  const renderTopBar = () => render(<TopBar themeMode="dark" onThemeModeChange={vi.fn()} />);

  it("renders the FIREWATCH logo and profile avatar", () => {
    renderTopBar();

    expect(screen.getByLabelText("FIREWATCH")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Profile" })).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles the profile dropdown on avatar click", () => {
    renderTopBar();

    const profileButton = screen.getByRole("button", { name: "Profile" });
    fireEvent.click(profileButton);

    expect(screen.getByLabelText("Profile menu")).toBeInTheDocument();
    expect(profileButton).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(profileButton);
    expect(screen.queryByLabelText("Profile menu")).not.toBeInTheDocument();
  });

  it("closes the profile dropdown on Escape", () => {
    renderTopBar();
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByLabelText("Profile menu")).not.toBeInTheDocument();
  });

  it("closes the profile dropdown on outside click", () => {
    renderTopBar();
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));

    fireEvent.mouseDown(document.body);

    expect(screen.queryByLabelText("Profile menu")).not.toBeInTheDocument();
  });

  it("supports demo role selection", () => {
    renderTopBar();
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));

    const roleSelect = screen.getByRole("combobox", { name: "Demo role" });
    fireEvent.change(roleSelect, { target: { value: "Disaster Management Official" } });

    expect(roleSelect).toHaveValue("Disaster Management Official");
  });
});
