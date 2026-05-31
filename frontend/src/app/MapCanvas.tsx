import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

import type { ActiveRiskAlert, LocationSearchResult, ThemeMode } from "../dashboard/types";
import { getBasemapConfig, getMapStyle } from "../features/map/mapStyles";

type MapCanvasProps = {
  accessToken: string;
  activeAlerts?: ActiveRiskAlert[];
  selectedLocation?: LocationSearchResult | null;
  themeMode: ThemeMode;
};

export const MapCanvas = ({ accessToken, activeAlerts = [], selectedLocation = null, themeMode }: MapCanvasProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const mapStyle = useRef(getMapStyle(themeMode));
  const currentThemeMode = useRef(themeMode);
  const [mapError, setMapError] = useState<string | null>(
    accessToken ? null : "Mapbox unavailable: add MAPBOX_ACCESS_TOKEN to the repository .env file."
  );
  currentThemeMode.current = themeMode;

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
      pitch: 35,
      attributionControl: false,
    });
    mapInstance.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.on("load", () => setMapError(null));
    map.on("style.load", () => {
      Object.entries(getBasemapConfig(currentThemeMode.current)).forEach(([property, value]) => {
        map.setConfigProperty("basemap", property, value);
      });
    });
    map.on("error", (event) => {
      const message = event.error?.message || "map failed to load.";
      setMapError(`Mapbox unavailable: ${message}`);
    });

    return () => {
      mapInstance.current = null;
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
      return;
    }

    mapInstance.current?.flyTo({
      center: [selectedLocation.longitude, selectedLocation.latitude],
      zoom: 9,
      pitch: 45,
    });
  }, [selectedLocation]);

  useEffect(() => {
    if (!mapInstance.current) {
      return;
    }

    const markers = activeAlerts.filter((alert) => alert.forecast_window === "now").map((alert) => {
      const element = document.createElement("button");
      const riskLevel = alert.risk_level.toLowerCase();
      element.type = "button";
      element.className = `map-marker animated-diamond-marker ${riskLevel}`;
      element.setAttribute("aria-label", `${alert.location_name} ${riskLevel} relative wildfire risk (${alert.forecast_window})`);

      return new mapboxgl.Marker({ element })
        .setLngLat([alert.longitude, alert.latitude])
        .addTo(mapInstance.current!);
    });

    return () => markers.forEach((marker) => marker.remove());
  }, [activeAlerts]);

  return (
    <section className="map-canvas-shell" role="region" aria-label="Türkiye monitoring map">
      <div ref={mapContainer} className="mapbox-canvas" />
      {selectedLocation ? (
        <div className="selected-location-overlays">
          <div className="monitoring-ring" aria-label="Monitoring radius" />
          <div className="selected-location-crosshair" aria-label="Selected location crosshair">
            <i />
            <i />
          </div>
        </div>
      ) : null}
      {mapError ? <p className="mapbox-error" role="alert">{mapError}</p> : null}
    </section>
  );
};
