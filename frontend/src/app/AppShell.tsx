import { useState } from "react";

import { BottomBar } from "./BottomBar";
import { MapCanvas } from "./MapCanvas";
import { TopBar } from "./TopBar";
import type { LocationSearchResult } from "../dashboard/types";
import { useAssessment } from "../dashboard/useAssessment";
import { useMonitoringData } from "../dashboard/useMonitoringData";
import { useThemeMode } from "../dashboard/useThemeMode";
import { DecisionSupportPanel } from "../features/decision-support/DecisionSupportPanel";
import { LocationInfoPanel } from "../features/location-info/LocationInfoPanel";
import { MonitoringRail } from "../features/monitoring-rail/MonitoringRail";
import { MapSearch } from "../features/search/MapSearch";

export const AppShell = () => {
  const { themeMode, setThemeMode } = useThemeMode();
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null);
  const [isDecisionSupportOpen, setIsDecisionSupportOpen] = useState(false);
  const { assessmentPayload, isAssessing, selectLocationForAssessment } = useAssessment();
  const { alerts, overview, refreshMonitoringData } = useMonitoringData();

  const selectLocation = (location: LocationSearchResult) => {
    setSelectedLocation(location);
    setIsDecisionSupportOpen(false);
    void selectLocationForAssessment(location).then(refreshMonitoringData);
  };

  const openDecisionSupport = () => {
    if (selectedLocation) {
      setIsDecisionSupportOpen(true);
    }
  };

  const closeSelectedLocation = () => {
    setSelectedLocation(null);
    setIsDecisionSupportOpen(false);
  };

  return (
    <div className="app-shell" data-theme={themeMode} data-testid="app-shell">
      <TopBar themeMode={themeMode} onThemeModeChange={setThemeMode} />
      <main className="map-workspace">
        <MapCanvas
          accessToken={__MAPBOX_TOKEN__}
          activeAlerts={alerts}
          selectedLocation={selectedLocation}
          themeMode={themeMode}
        />
        <MapSearch onSelectLocation={selectLocation} />
        {selectedLocation ? (
          <LocationInfoPanel
            assessmentPayload={assessmentPayload}
            isAssessing={isAssessing}
            location={selectedLocation}
            onClose={closeSelectedLocation}
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
        {!isDecisionSupportOpen ? <MonitoringRail alerts={alerts} overview={overview} /> : null}
      </main>
      <BottomBar activeAlertCount={alerts.length} selectedCity={selectedLocation?.display_name ?? null} />
    </div>
  );
};
