import { useState } from "react";

import { BottomBar } from "./BottomBar";
import { MapCanvas } from "./MapCanvas";
import { TopBar } from "./TopBar";
import type { LocationSearchResult } from "../dashboard/types";
import { useThemeMode } from "../dashboard/useThemeMode";
import { MapSearch } from "../features/search/MapSearch";

export const AppShell = () => {
  const { themeMode, setThemeMode } = useThemeMode();
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null);

  return (
    <div className="app-shell" data-theme={themeMode} data-testid="app-shell">
      <TopBar themeMode={themeMode} onThemeModeChange={setThemeMode} />
      <main className="map-workspace">
        <MapCanvas accessToken={__MAPBOX_TOKEN__} selectedLocation={selectedLocation} />
        <MapSearch onSelectLocation={setSelectedLocation} />
      </main>
      <BottomBar selectedCity={selectedLocation?.display_name ?? null} />
    </div>
  );
};
