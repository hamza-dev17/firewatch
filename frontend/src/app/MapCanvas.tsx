import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

import type { LocationSearchResult } from "../dashboard/types";

type MapCanvasProps = {
  accessToken: string;
  selectedLocation?: LocationSearchResult | null;
};

export const MapCanvas = ({ accessToken, selectedLocation = null }: MapCanvasProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(
    accessToken ? null : "Mapbox unavailable: add MAPBOX_ACCESS_TOKEN to the repository .env file."
  );

  useEffect(() => {
    if (!mapContainer.current || !accessToken) {
      return;
    }

    mapboxgl.accessToken = accessToken;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [35.2433, 38.9637],
      zoom: 5.2,
      attributionControl: false,
    });
    mapInstance.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.on("load", () => setMapError(null));
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
    if (!selectedLocation) {
      return;
    }

    mapInstance.current?.flyTo({
      center: [selectedLocation.longitude, selectedLocation.latitude],
      zoom: 9,
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
