import type { ThemeMode } from "../../dashboard/types";

const MAP_STYLES: Record<ThemeMode, string> = {
  dark: "mapbox://styles/mapbox/standard",
  light: "mapbox://styles/mapbox/standard-satellite",
};

const BASEMAP_CONFIG = {
  dark: {
    lightPreset: "night",
    show3dObjects: false,
    showPointOfInterestLabels: false,
    showTransitLabels: false,
  },
  light: {
    lightPreset: "day",
    show3dObjects: false,
  },
} satisfies Record<ThemeMode, Record<string, string | boolean>>;

export const getMapStyle = (themeMode: ThemeMode) => MAP_STYLES[themeMode];

export const getBasemapConfig = (themeMode: ThemeMode) => BASEMAP_CONFIG[themeMode];
