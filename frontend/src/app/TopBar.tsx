import { useEffect, useRef, useState } from "react";

import type { DemoRole, ThemeMode } from "../dashboard/types";
import { ProfileDropdown } from "../features/settings/ProfileDropdown";

type TopBarProps = {
  themeMode: ThemeMode;
  onThemeModeChange: (themeMode: ThemeMode) => void;
};

export const TopBar = ({ themeMode, onThemeModeChange }: TopBarProps) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [role, setRole] = useState<DemoRole>("Forest Officer");
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isProfileOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileOpen]);

  return (
    <header className="top-bar">
      <div className="brand" aria-label="FIREWATCH">
        <span className="brand-mark" aria-hidden="true" />
        <strong>FIREWATCH</strong>
      </div>
      <div className="top-bar-actions">
        <div className="theme-control" aria-label="Theme mode">
          <button type="button" aria-pressed={themeMode === "dark"} onClick={() => onThemeModeChange("dark")}>
            Dark theme
          </button>
          <button type="button" aria-pressed={themeMode === "light"} onClick={() => onThemeModeChange("light")}>
            Light theme
          </button>
        </div>
        <span className="live-indicator"><i />LIVE</span>
        <button className="top-bar-button" type="button" aria-label="Settings">&#9881;</button>
        <div className="profile-menu" ref={profileRef}>
          <button
            className="profile-avatar"
            type="button"
            aria-label="Profile"
            aria-expanded={isProfileOpen}
            aria-controls="profile-dropdown"
            aria-haspopup="true"
            onClick={() => setIsProfileOpen((isOpen) => !isOpen)}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="6.5" r="3" />
              <path d="M4 17c.5-3.1 2.5-4.8 6-4.8s5.5 1.7 6 4.8" />
            </svg>
          </button>
          {isProfileOpen ? <ProfileDropdown role={role} onRoleChange={setRole} /> : null}
        </div>
      </div>
    </header>
  );
};
