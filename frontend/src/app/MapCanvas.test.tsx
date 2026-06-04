import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mapConstructor = vi.fn();
const flyTo = vi.fn();
const setStyle = vi.fn();
const setConfigProperty = vi.fn();
const markerAddTo = vi.fn();
const markerRemove = vi.fn();
const markerSetLngLat = vi.fn();
const markerConstructor = vi.fn();
const addImage = vi.fn();
const addLayer = vi.fn();
const addSource = vi.fn();
const getLayer = vi.fn();
const getSource = vi.fn();
const hasImage = vi.fn();
const removeLayer = vi.fn();
const removeSource = vi.fn();
const markerElements: HTMLElement[] = [];
let emitStyleLoad: ((event: Record<string, never>) => void) | undefined;
let emitMapError: ((event: { error?: { message?: string } }) => void) | undefined;

vi.mock("mapbox-gl", () => {
  class MockMap {
    constructor(options: unknown) {
      mapConstructor(options);
    }

    addControl() {
      return this;
    }

    addImage(id: string, image: unknown) {
      addImage(id, image);
      return this;
    }

    addLayer(layer: unknown) {
      addLayer(layer);
      return this;
    }

    addSource(id: string, source: unknown) {
      addSource(id, source);
      return this;
    }

    flyTo(options: unknown) {
      flyTo(options);
      return this;
    }

    getLayer(id: string) {
      return getLayer(id);
    }

    getSource(id: string) {
      return getSource(id);
    }

    hasImage(id: string) {
      return hasImage(id);
    }

    setStyle(style: string) {
      setStyle(style);
      emitStyleLoad?.({});
      return this;
    }

    setConfigProperty(...options: unknown[]) {
      setConfigProperty(...options);
      return this;
    }

    on(event: string, callback: (event: { error?: { message?: string } }) => void) {
      if (event === "load") callback({});
      if (event === "style.load") emitStyleLoad = callback;
      if (event === "error") emitMapError = callback;
      return this;
    }

    removeLayer(id: string) {
      removeLayer(id);
      return this;
    }

    removeSource(id: string) {
      removeSource(id);
      return this;
    }

    remove() {
      return this;
    }
  }

  class MockNavigationControl {}

  class MockMarker {
    constructor(options: { element: HTMLElement; anchor?: string; offset?: [number, number] }) {
      markerConstructor(options);
      const { element } = options;
      markerElements.push(element);
    }

    addTo(map: unknown) {
      markerAddTo(map);
      return this;
    }

    remove() {
      markerRemove();
      return this;
    }

    setLngLat(coordinates: unknown) {
      markerSetLngLat(coordinates);
      return this;
    }
  }

  return {
    default: {
      accessToken: "",
      Map: MockMap,
      Marker: MockMarker,
      NavigationControl: MockNavigationControl,
    },
  };
});

import { MapCanvas } from "./MapCanvas";

describe("MapCanvas", () => {
  beforeEach(() => {
    mapConstructor.mockClear();
    flyTo.mockClear();
    setStyle.mockClear();
    setConfigProperty.mockClear();
    markerAddTo.mockClear();
    markerRemove.mockClear();
    markerSetLngLat.mockClear();
    markerConstructor.mockClear();
    addImage.mockClear();
    addLayer.mockClear();
    addSource.mockClear();
    getLayer.mockReset();
    getLayer.mockReturnValue(undefined);
    getSource.mockReset();
    getSource.mockReturnValue(undefined);
    hasImage.mockReset();
    hasImage.mockReturnValue(false);
    removeLayer.mockClear();
    removeSource.mockClear();
    markerElements.length = 0;
    emitStyleLoad = undefined;
    emitMapError = undefined;
  });

  it("renders the full-screen Türkiye Mapbox workspace", () => {
    render(<MapCanvas accessToken="test-mapbox-token" themeMode="dark" />);

    expect(screen.getByRole("region", { name: "Türkiye monitoring map" })).toBeInTheDocument();
    expect(mapConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        style: "mapbox://styles/mapbox/standard",
        config: {
          basemap: {
            lightPreset: "night",
            show3dObjects: false,
            showPointOfInterestLabels: false,
            showTransitLabels: false,
          },
        },
        center: [35.2433, 38.9637],
        zoom: 5.2,
        pitch: 0,
        projection: "mercator",
      })
    );
  });

  it("explains how to configure Mapbox when the access token is missing", () => {
    render(<MapCanvas accessToken="" themeMode="dark" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Mapbox unavailable: add MAPBOX_ACCESS_TOKEN to the repository .env file."
    );
    expect(mapConstructor).not.toHaveBeenCalled();
  });

  it("shows Mapbox runtime failures instead of leaving an empty workspace", () => {
    render(<MapCanvas accessToken="rejected-mapbox-token" themeMode="dark" />);

    act(() => emitMapError?.({ error: { message: "401 Unauthorized" } }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Mapbox unavailable: 401 Unauthorized"
    );
  });

  it("pans to the selected location and shows its inspection overlays", () => {
    const { rerender } = render(<MapCanvas accessToken="test-mapbox-token" themeMode="dark" />);

    rerender(
      <MapCanvas
        accessToken="test-mapbox-token"
        themeMode="dark"
        selectedLocation={{
          display_name: "Ankara, Turkiye",
          latitude: 39.9334,
          longitude: 32.8597,
          admin: { province: "Ankara", district: "Cankaya", country: "Turkiye" },
          source_label: "curated-index",
        }}
      />
    );

    expect(flyTo).toHaveBeenCalledWith({ center: [32.8597, 39.9334], zoom: 9, pitch: 0 });
    expect(screen.getByLabelText("Selected location crosshair")).toBeInTheDocument();
    expect(screen.getByLabelText("Monitoring radius")).toBeInTheDocument();
  });

  it("switches to standard satellite when the light theme is selected", () => {
    const { rerender } = render(<MapCanvas accessToken="test-mapbox-token" themeMode="dark" />);

    rerender(<MapCanvas accessToken="test-mapbox-token" themeMode="light" />);

    expect(setStyle).toHaveBeenCalledWith("mapbox://styles/mapbox/standard-satellite");
    expect(setConfigProperty).toHaveBeenCalledWith("basemap", "lightPreset", "day");
    expect(setConfigProperty).toHaveBeenCalledWith("basemap", "show3dObjects", false);
  });

  it("renders active alerts as animated diamond markers", () => {
    render(
      <MapCanvas
        accessToken="test-mapbox-token"
        activeAlerts={[
          {
            id: "alert-1",
            created_at: "2026-05-31T09:00:00Z",
            expires_at: "2026-05-31T12:00:00Z",
            status: "active",
            recommendation_rule_version: "v1",
            location_name: "Mugla",
            latitude: 37.2153,
            longitude: 28.3636,
            risk_level: "critical",
            risk_score: 0.91,
            forecast_window: "now",
            recommended_action: "Prioritize local inspection",
            alert_text: "Critical relative wildfire risk",
          },
        ]}
        themeMode="dark"
      />
    );

    expect(markerConstructor).not.toHaveBeenCalled();
    expect(addSource).toHaveBeenCalledWith(
      "firewatch-risk-markers",
      expect.objectContaining({
        type: "geojson",
        data: expect.objectContaining({
          features: [
            expect.objectContaining({
              geometry: { type: "Point", coordinates: [28.3636, 37.2153] },
              properties: expect.objectContaining({
                ariaLabel: "Mugla critical relative wildfire risk (now)",
                icon: "risk-diamond-critical",
                riskLevel: "critical",
              }),
              type: "Feature",
            }),
          ],
          type: "FeatureCollection",
        }),
      })
    );
    expect(addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: "firewatch-risk-marker-icons" }));
    expect(addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: "firewatch-risk-marker-pulses" }));
  });

  it("renders overview hotspots and watchlist summaries as animated diamond markers", () => {
    render(
      <MapCanvas
        accessToken="test-mapbox-token"
        overview={{
          source_state: "live",
          monitoring_locations: [
            { name: "Izmir", latitude: 38.4237, longitude: 27.1428, data_source_label: "system-watchlist" },
          ],
          predicted_risk_hotspots: [
            {
              name: "Mugla",
              latitude: 37.2153,
              longitude: 28.3636,
              risk_level: "critical",
              data_source_label: "demo-hotspots",
              label: "Critical hotspot",
            },
            {
              name: "Balikesir",
              latitude: 39.6484,
              longitude: 27.8826,
              risk_level: "high",
              data_source_label: "demo-hotspots",
              label: "High hotspot",
            },
          ],
          regional_summaries: [
            {
              region: "Izmir",
              risk_level: "medium",
              risk_score: 0.51,
              assessed_at: "2026-05-31T10:30:00Z",
              data_source_label: "system-watchlist-history",
            },
          ],
          top_priority_regions: [],
          data_source_labels: {
            overview: "system-watchlist-history",
            hotspots: "demo-hotspots",
            monitoring_locations: "system-watchlist",
            regional_summary: "system-watchlist-history",
            top_priority_regions: "system-watchlist-history",
          },
          message: null,
        }}
        themeMode="dark"
      />
    );

    expect(markerConstructor).not.toHaveBeenCalled();
    expect(addSource).toHaveBeenCalledWith(
      "firewatch-risk-markers",
      expect.objectContaining({
        data: expect.objectContaining({
          features: expect.arrayContaining([
            expect.objectContaining({ geometry: { type: "Point", coordinates: [28.3636, 37.2153] } }),
            expect.objectContaining({ geometry: { type: "Point", coordinates: [27.8826, 39.6484] } }),
            expect.objectContaining({ geometry: { type: "Point", coordinates: [27.1428, 38.4237] } }),
          ]),
        }),
        type: "geojson",
      })
    );
  });

  it("does not render future-window alerts as current map markers", () => {
    render(
      <MapCanvas
        accessToken="test-mapbox-token"
        activeAlerts={[
          {
            id: "alert-24h",
            created_at: "2026-05-31T09:00:00Z",
            expires_at: "2026-06-01T09:00:00Z",
            status: "active",
            recommendation_rule_version: "v1",
            location_name: "Ankara",
            latitude: 39.9334,
            longitude: 32.8597,
            risk_level: "high",
            risk_score: 0.74,
            forecast_window: "24h",
            recommended_action: "Prioritize local inspection",
            alert_text: "High relative wildfire risk",
          },
        ]}
        themeMode="dark"
      />
    );

    expect(addSource).toHaveBeenCalledWith(
      "firewatch-risk-markers",
      expect.objectContaining({
        data: expect.objectContaining({
          features: [],
          type: "FeatureCollection",
        }),
        type: "geojson",
      })
    );
  });
});
