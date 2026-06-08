import { useEffect, useState } from "react";

import type { ThemeMode, ViewKey } from "../dashboard/types";
import { ProfileModal } from "../features/settings/ProfileModal";
import {
  getOperatorInitials,
  loadOperatorProfile,
  type OperatorProfile,
  saveOperatorProfile,
} from "../features/settings/operatorProfile";

type TopBarProps = {
  themeMode: ThemeMode;
  onThemeModeChange: (themeMode: ThemeMode) => void;
  onSettingsOpen: () => void;
  onProfileMenuOpenChange?: (isOpen: boolean) => void;
  activeView?: ViewKey;
  onViewChange?: (view: ViewKey) => void;
};

export const TopBar = ({
  themeMode,
  onThemeModeChange,
  onSettingsOpen,
  onProfileMenuOpenChange,
  activeView = "monitoring",
  onViewChange,
}: TopBarProps) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState<OperatorProfile>(() => loadOperatorProfile());

  useEffect(() => {
    onProfileMenuOpenChange?.(isProfileOpen);
  }, [isProfileOpen, onProfileMenuOpenChange]);

  const handleProfileSave = (nextProfile: OperatorProfile) => {
    setProfile(nextProfile);
    saveOperatorProfile(nextProfile);
  };

  return (
    <>
      <header className="top-bar">
        <div className="brand" aria-label="FIREWATCH">
          <span className="brand-mark" aria-hidden="true" />
          <strong>FIREWATCH</strong>
        </div>
        <div className="top-bar-actions">
          <nav className="view-switcher" aria-label="Workspace views">
            <button
              type="button"
              aria-pressed={activeView === "monitoring"}
              onClick={() => onViewChange?.("monitoring")}
            >
              Monitoring Dashboard
            </button>
            <button
              type="button"
              aria-pressed={activeView === "history"}
              onClick={() => onViewChange?.("history")}
            >
              Prediction History
            </button>
          </nav>
          <div className="theme-control" aria-label="Theme mode">
            <button type="button" aria-pressed={themeMode === "dark"} onClick={() => onThemeModeChange("dark")}>
              Dark theme
            </button>
            <button type="button" aria-pressed={themeMode === "light"} onClick={() => onThemeModeChange("light")}>
              Light theme
            </button>
          </div>
          <span className="live-indicator"><i />LIVE</span>
          <button className="top-bar-button" type="button" aria-label="Settings" onClick={onSettingsOpen}>
            &#9881;
          </button>
          <button
            className="profile-avatar"
            type="button"
            aria-label="Open operator profile"
            aria-expanded={isProfileOpen}
            aria-haspopup="dialog"
            onClick={() => setIsProfileOpen(true)}
          >
            <span aria-hidden="true">{getOperatorInitials(profile.displayName)}</span>
          </button>
        </div>
      </header>

      {isProfileOpen && (
        <ProfileModal
          onClose={() => setIsProfileOpen(false)}
          profile={profile}
          onSave={handleProfileSave}
        />
      )}
    </>
  );
};
