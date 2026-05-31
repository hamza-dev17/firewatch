import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

import type { LocationSearchResult, ThemeMode } from "../dashboard/types";
import { getBasemapConfig, getMapStyle } from "../features/map/mapStyles";

type MapCanvasProps = {
  accessToken: string;
  selectedLocation?: LocationSearchResult | null;
  themeMode: ThemeMode;
};

export const MapCanvas = ({ accessToken, selectedLocation = null, themeMode }: MapCanvasProps) => {
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
