import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

import type {
  ActiveRiskAlert,
  LocationSearchResult,
  MonitoringOverviewPayload,
  ThemeMode,
} from "../dashboard/types";
import { getBasemapConfig, getMapStyle } from "../features/map/mapStyles";

type MapCanvasProps = {
  accessToken: string;
  activeAlerts?: ActiveRiskAlert[];
  onSelectLocation?: (location: LocationSearchResult) => void;
  overview?: MonitoringOverviewPayload | null;
  selectedLocation?: LocationSearchResult | null;
  themeMode: ThemeMode;
};

type MapMarkerDefinition = {
  key: string;
  latitude: number;
  longitude: number;
  riskLevel: string;
  ariaLabel: string;
};

type RiskMarkerFeatureCollection = ReturnType<typeof riskMarkerFeatureCollection>;

const DISPLAYED_RISK_LEVELS = new Set(["medium", "high", "critical"]);
const RISK_MARKER_SOURCE_ID = "firewatch-risk-markers";
const RISK_MARKER_ICON_LAYER_ID = "firewatch-risk-marker-icons";
const RISK_MARKER_PULSE_LAYER_ID = "firewatch-risk-marker-pulses";
const RISK_MARKER_COLORS = {
  medium: [226, 179, 64],
  high: [232, 114, 58],
  critical: [229, 72, 77],
} satisfies Record<string, [number, number, number]>;
const TURKIYE_BOUNDS = {
  west: 25.5,
  east: 45.2,
  south: 35.6,
  north: 42.2,
};

const isWithinTurkiyeBounds = (longitude: number, latitude: number) =>
  longitude >= TURKIYE_BOUNDS.west &&
  longitude <= TURKIYE_BOUNDS.east &&
  latitude >= TURKIYE_BOUNDS.south &&
  latitude <= TURKIYE_BOUNDS.north;

const buildMapClickLocation = (longitude: number, latitude: number): LocationSearchResult => ({
  display_name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}, Turkiye`,
  latitude,
  longitude,
  admin: {
    province: "Map selected",
    district: "",
    country: "Turkiye",
  },
  source_label: "map-click",
});

const markerKey = (name: string, latitude: number, longitude: number) =>
  `${name.trim().toLowerCase()}|${latitude}|${longitude}`;

const buildOverviewMarkers = (overview?: MonitoringOverviewPayload | null): MapMarkerDefinition[] => {
  if (!overview) {
    return [];
  }

  const markers = new Map<string, MapMarkerDefinition>();
  const locationsByRegion = new Map(
    overview.monitoring_locations.map((location) => [location.name.trim().toLowerCase(), location])
  );

  overview.predicted_risk_hotspots.forEach((hotspot) => {
    const riskLevel = hotspot.risk_level.toLowerCase();
    if (!DISPLAYED_RISK_LEVELS.has(riskLevel)) {
      return;
    }

    markers.set(markerKey(hotspot.name, hotspot.latitude, hotspot.longitude), {
      key: markerKey(hotspot.name, hotspot.latitude, hotspot.longitude),
      latitude: hotspot.latitude,
      longitude: hotspot.longitude,
      riskLevel,
      ariaLabel: `${hotspot.name} ${riskLevel} predicted risk hotspot`,
    });
  });

  overview.regional_summaries.forEach((summary) => {
    const riskLevel = summary.risk_level.toLowerCase();
    if (!DISPLAYED_RISK_LEVELS.has(riskLevel)) {
      return;
    }

    const location = locationsByRegion.get(summary.region.trim().toLowerCase());
    if (!location) {
      return;
    }

    markers.set(markerKey(summary.region, location.latitude, location.longitude), {
      key: markerKey(summary.region, location.latitude, location.longitude),
      latitude: location.latitude,
      longitude: location.longitude,
      riskLevel,
      ariaLabel: `${summary.region} ${riskLevel} monitoring region`,
    });
  });

  return Array.from(markers.values());
};

const buildAlertMarkers = (activeAlerts: ActiveRiskAlert[]): MapMarkerDefinition[] =>
  activeAlerts
    .filter((alert) => alert.forecast_window === "now")
    .map((alert) => {
      const riskLevel = alert.risk_level.toLowerCase();
      return {
        key: markerKey(alert.location_name, alert.latitude, alert.longitude),
        latitude: alert.latitude,
        longitude: alert.longitude,
        riskLevel,
        ariaLabel: `${alert.location_name} ${riskLevel} relative wildfire risk (${alert.forecast_window})`,
      };
    });

const createDiamondImage = (color: [number, number, number], pulse = false): mapboxgl.StyleImageInterface => {
  const width = 32;
  const height = 32;
  const center = (width - 1) / 2;
  const radius = pulse ? 13 : 7;
  const borderWidth = pulse ? 1.5 : 0;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const distance = Math.abs(x - center) + Math.abs(y - center);
      const index = (y * width + x) * 4;
      const isFilled = !pulse && distance <= radius;
      const isBorder = pulse && distance <= radius && distance >= radius - borderWidth;

      if (!isFilled && !isBorder) {
        continue;
      }

      data[index] = color[0];
      data[index + 1] = color[1];
      data[index + 2] = color[2];
      data[index + 3] = pulse ? 70 : 255;
    }
  }

  return { width, height, data };
};

const riskMarkerFeatureCollection = (markers: MapMarkerDefinition[]) => ({
  type: "FeatureCollection" as const,
  features: markers.map((marker) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [marker.longitude, marker.latitude],
    },
    properties: {
      ariaLabel: marker.ariaLabel,
      icon: `risk-diamond-${marker.riskLevel}`,
      pulseIcon: `risk-diamond-pulse-${marker.riskLevel}`,
      riskLevel: marker.riskLevel,
    },
  })),
});

const registerRiskMarkerImages = (map: mapboxgl.Map) => {
  Object.entries(RISK_MARKER_COLORS).forEach(([riskLevel, color]) => {
    const iconId = `risk-diamond-${riskLevel}`;
    const pulseIconId = `risk-diamond-pulse-${riskLevel}`;

    if (!map.hasImage(iconId)) {
      map.addImage(iconId, createDiamondImage(color), { pixelRatio: 2 });
    }

    if (!map.hasImage(pulseIconId)) {
      map.addImage(pulseIconId, createDiamondImage(color, true), { pixelRatio: 2 });
    }
  });
};

const syncRiskMarkerLayers = (map: mapboxgl.Map, markers: MapMarkerDefinition[]) => {
  registerRiskMarkerImages(map);

  const data = riskMarkerFeatureCollection(markers);
  const existingSource = map.getSource(RISK_MARKER_SOURCE_ID) as
    | { setData?: (data: RiskMarkerFeatureCollection) => void }
    | undefined;

  if (existingSource?.setData) {
    existingSource.setData(data);
  } else if (!existingSource) {
    map.addSource(RISK_MARKER_SOURCE_ID, {
      type: "geojson",
      data,
    });
  }

  if (!map.getLayer(RISK_MARKER_PULSE_LAYER_ID)) {
    map.addLayer({
      id: RISK_MARKER_PULSE_LAYER_ID,
      type: "symbol",
      source: RISK_MARKER_SOURCE_ID,
      layout: {
        "icon-allow-overlap": true,
        "icon-anchor": "center",
        "icon-ignore-placement": true,
        "icon-image": ["get", "pulseIcon"],
        "icon-size": 1,
      },
    });
  }

  if (!map.getLayer(RISK_MARKER_ICON_LAYER_ID)) {
    map.addLayer({
      id: RISK_MARKER_ICON_LAYER_ID,
      type: "symbol",
      source: RISK_MARKER_SOURCE_ID,
      layout: {
        "icon-allow-overlap": true,
        "icon-anchor": "center",
        "icon-ignore-placement": true,
        "icon-image": ["get", "icon"],
        "icon-size": 1,
      },
    });
  }
};

export const MapCanvas = ({
  accessToken,
  activeAlerts = [],
  onSelectLocation,
  overview = null,
  selectedLocation = null,
  themeMode,
}: MapCanvasProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const selectedMarker = useRef<mapboxgl.Marker | null>(null);
  const onSelectLocationRef = useRef<MapCanvasProps["onSelectLocation"]>(onSelectLocation);
  const mapStyle = useRef(getMapStyle(themeMode));
  const currentThemeMode = useRef(themeMode);
  const [isMapReady, setIsMapReady] = useState(false);
  const [styleRevision, setStyleRevision] = useState(0);
  const [mapError, setMapError] = useState<string | null>(
    accessToken ? null : "Mapbox unavailable: add MAPBOX_ACCESS_TOKEN to the repository .env file."
  );
  currentThemeMode.current = themeMode;
  onSelectLocationRef.current = onSelectLocation;

  useEffect(() => {
    if (!mapContainer.current || !accessToken) {
      return;
    }

    mapboxgl.accessToken = accessToken;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle.current,
      config: {
        basemap: getBasemapConfig(themeMode),
      },
      center: [35.2433, 38.9637],
      zoom: 5.2,
      pitch: 0,
      projection: "mercator",
      attributionControl: false,
    });
    mapInstance.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.on("click", (event) => {
      const { lng, lat } = event.lngLat;

      if (!isWithinTurkiyeBounds(lng, lat)) {
        return;
      }

      onSelectLocationRef.current?.(buildMapClickLocation(lng, lat));
    });
    map.on("load", () => {
      setMapError(null);
      setIsMapReady(true);
    });
    map.on("style.load", () => {
      Object.entries(getBasemapConfig(currentThemeMode.current)).forEach(([property, value]) => {
        map.setConfigProperty("basemap", property, value);
      });
      setStyleRevision((currentRevision) => currentRevision + 1);
    });
    map.on("error", (event) => {
      const message = event.error?.message || "map failed to load.";
      setMapError(`Mapbox unavailable: ${message}`);
    });

    return () => {
      setIsMapReady(false);
      mapInstance.current = null;
      selectedMarker.current?.remove();
      selectedMarker.current = null;
      map.remove();
    };
  }, [accessToken]);

  useEffect(() => {
    const nextMapStyle = getMapStyle(themeMode);

    if (mapStyle.current === nextMapStyle) {
      return;
    }

    mapStyle.current = nextMapStyle;
    mapInstance.current?.setStyle(nextMapStyle);
  }, [themeMode]);

  useEffect(() => {
    if (!selectedLocation) {
      selectedMarker.current?.remove();
      selectedMarker.current = null;
      return;
    }

    mapInstance.current?.flyTo({
      center: [selectedLocation.longitude, selectedLocation.latitude],
      zoom: 9,
      pitch: 0,
    });

    if (!mapInstance.current || !isMapReady) {
      return;
    }

    selectedMarker.current?.remove();
    const markerElement = document.createElement("div");
    markerElement.className = "selected-location-marker";
    markerElement.setAttribute("aria-label", "Selected location diamond");
    markerElement.innerHTML = `
      <span class="selected-location-pulse" aria-label="Monitoring radius"></span>
      <span class="selected-location-inner-ring" aria-hidden="true"></span>
      <span class="selected-location-diamond" aria-hidden="true"></span>
      <span class="selected-location-crosshair" aria-label="Selected location crosshair">
        <i></i>
        <i></i>
      </span>
    `;
    selectedMarker.current = new mapboxgl.Marker({ element: markerElement, anchor: "center" })
      .setLngLat([selectedLocation.longitude, selectedLocation.latitude])
      .addTo(mapInstance.current);
  }, [isMapReady, selectedLocation]);

  useEffect(() => {
    if (!mapInstance.current || !isMapReady) {
      return;
    }

    const markerDefinitions = new Map<string, MapMarkerDefinition>();
    buildOverviewMarkers(overview).forEach((marker) => {
      markerDefinitions.set(marker.key, marker);
    });
    buildAlertMarkers(activeAlerts).forEach((marker) => {
      markerDefinitions.set(marker.key, marker);
    });

    syncRiskMarkerLayers(mapInstance.current, Array.from(markerDefinitions.values()));
  }, [activeAlerts, overview, isMapReady, styleRevision]);

  return (
    <section className="map-canvas-shell" role="region" aria-label="Türkiye monitoring map">
      <div ref={mapContainer} className="mapbox-canvas" />
      {mapError ? <p className="mapbox-error" role="alert">{mapError}</p> : null}
    </section>
  );
};
