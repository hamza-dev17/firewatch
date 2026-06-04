import { lazy, Suspense, useState } from "react";

import { BottomBar } from "./BottomBar";
import { TopBar } from "./TopBar";
import type { LocationSearchResult } from "../dashboard/types";
import { useAssessment } from "../dashboard/useAssessment";
import { useDashboardStatus } from "../dashboard/useDashboardStatus";
import { useMonitoringData } from "../dashboard/useMonitoringData";
import { usePredictionHistory } from "../dashboard/usePredictionHistory";
import { useThemeMode } from "../dashboard/useThemeMode";
import type { ViewKey } from "../dashboard/types";
import { DecisionSupportPanel } from "../features/decision-support/DecisionSupportPanel";
import { PredictionHistoryPanel } from "../features/history/PredictionHistoryPanel";
import { LocationInfoPanel } from "../features/location-info/LocationInfoPanel";
import { MonitoringRail } from "../features/monitoring-rail/MonitoringRail";
import { MapSearch } from "../features/search/MapSearch";
import { SettingsDrawer } from "../features/settings/SettingsDrawer";

const MapCanvas = lazy(() => import("./MapCanvas").then((module) => ({ default: module.MapCanvas })));

export const AppShell = () => {
  const { themeMode, setThemeMode } = useThemeMode();
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null);
  const [isDecisionSupportOpen, setIsDecisionSupportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState<ViewKey>("monitoring");
  const { assessmentPayload, isAssessing, selectLocationForAssessment } = useAssessment();
  const { statusPayload } = useDashboardStatus();
  const { alerts, overview, refreshMonitoringData } = useMonitoringData();
  const predictionHistory = usePredictionHistory();
  const defaultModelAlgorithm = statusPayload?.runtime?.model_evidence?.selected_algorithm ?? null;

  const [selectedModelAlgorithm, setSelectedModelAlgorithm] = useState<string | null>(null);
  const activeModelAlgorithm = selectedModelAlgorithm ?? defaultModelAlgorithm ?? undefined;

  const selectLocation = (location: LocationSearchResult) => {
    setSelectedLocation(location);
    setIsDecisionSupportOpen(false);
    void selectLocationForAssessment(location, activeModelAlgorithm).then(refreshMonitoringData);
  };

  const handleModelAlgorithmChange = (algorithm: string) => {
    setSelectedModelAlgorithm(algorithm);
    if (selectedLocation) {
      void selectLocationForAssessment(selectedLocation, algorithm).then(refreshMonitoringData);
    }
  };

  const openDecisionSupport = () => {
    if (selectedLocation) {
      setActiveView("monitoring");
      setIsDecisionSupportOpen(true);
    }
  };

  const changeView = (view: ViewKey) => {
    setActiveView(view);
    setIsDecisionSupportOpen(false);
    if (view === "history") {
      void predictionHistory.loadHistory();
    }
  };

  const closeSelectedLocation = () => {
    setSelectedLocation(null);
    setIsDecisionSupportOpen(false);
  };

  return (
    <div className="app-shell" data-theme={themeMode} data-testid="app-shell">
      <TopBar
        activeView={activeView}
        themeMode={themeMode}
        onViewChange={changeView}
        onThemeModeChange={setThemeMode}
        onSettingsOpen={() => setIsSettingsOpen(true)}
        onProfileMenuOpenChange={setIsProfileMenuOpen}
      />
      <main className="map-workspace">
        <Suspense fallback={<section className="map-canvas-shell" role="region" aria-label="Türkiye monitoring map" />}>
          <MapCanvas
            accessToken={__MAPBOX_TOKEN__}
            activeAlerts={alerts}
            overview={overview}
            selectedLocation={selectedLocation}
            themeMode={themeMode}
          />
        </Suspense>
        {activeView === "monitoring" ? <MapSearch onSelectLocation={selectLocation} /> : null}
        {activeView === "history" ? (
          <PredictionHistoryPanel
            onArchiveRecord={predictionHistory.archiveRecord}
            isLoading={predictionHistory.isLoading}
            message={predictionHistory.message}
            onApplyFilters={predictionHistory.loadHistory}
            records={predictionHistory.records}
          />
        ) : null}
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
        {isSettingsOpen ? (
          <SettingsDrawer
            overview={overview}
            statusPayload={statusPayload}
            selectedModelAlgorithm={selectedModelAlgorithm ?? defaultModelAlgorithm}
            onModelAlgorithmChange={handleModelAlgorithmChange}
            onClose={() => setIsSettingsOpen(false)}
          />
        ) : null}
        {activeView === "monitoring" && !isDecisionSupportOpen && !isSettingsOpen && !isProfileMenuOpen ? (
          <MonitoringRail alerts={alerts} overview={overview} />
        ) : null}
      </main>
      <BottomBar activeAlertCount={alerts.length} selectedCity={selectedLocation?.display_name ?? null} />
    </div>
  );
};
