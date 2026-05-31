import { useState } from "react";

import { BottomBar } from "./BottomBar";
import { MapCanvas } from "./MapCanvas";
import { TopBar } from "./TopBar";
import type { LocationSearchResult } from "../dashboard/types";
import { useAssessment } from "../dashboard/useAssessment";
import { useThemeMode } from "../dashboard/useThemeMode";
import { DecisionSupportPanel } from "../features/decision-support/DecisionSupportPanel";
import { LocationInfoPanel } from "../features/location-info/LocationInfoPanel";
import { MapSearch } from "../features/search/MapSearch";

export const AppShell = () => {
  const { themeMode, setThemeMode } = useThemeMode();
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null);
  const [isDecisionSupportOpen, setIsDecisionSupportOpen] = useState(false);
  const { assessmentPayload, isAssessing, selectLocationForAssessment } = useAssessment();

  const selectLocation = (location: LocationSearchResult) => {
    setSelectedLocation(location);
    setIsDecisionSupportOpen(false);
    void selectLocationForAssessment(location);
  };

  const openDecisionSupport = () => {
    if (selectedLocation) {
      setIsDecisionSupportOpen(true);
    }
  };

  return (
    <div className="app-shell" data-theme={themeMode} data-testid="app-shell">
      <TopBar themeMode={themeMode} onThemeModeChange={setThemeMode} />
      <main className="map-workspace">
        <MapCanvas accessToken={__MAPBOX_TOKEN__} selectedLocation={selectedLocation} themeMode={themeMode} />
        <MapSearch onSelectLocation={selectLocation} />
        {selectedLocation ? (
          <LocationInfoPanel
            assessmentPayload={assessmentPayload}
            isAssessing={isAssessing}
            location={selectedLocation}
            onViewFullAssessment={openDecisionSupport}
          />
        ) : null}
        {isDecisionSupportOpen ? (
          <DecisionSupportPanel
            assessmentPayload={assessmentPayload}
            isAssessing={isAssessing}
            location={selectedLocation}
            onClose={() => setIsDecisionSupportOpen(false)}
          />
        ) : null}
      </main>
      <BottomBar selectedCity={selectedLocation?.display_name ?? null} />
    </div>
  );
};
