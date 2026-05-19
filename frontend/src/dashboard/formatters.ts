import { READING_LABELS, READING_UNITS, type StatusState } from "./types";

export const formatState = (state: StatusState): string => {
  return state[0].toUpperCase() + state.slice(1);
};

export const formatLabel = (label: string | undefined): string => {
  if (!label) {
    return "Unavailable";
  }

  return label
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
};

export const formatForecastWindow = (window: string): string => {
  return window === "now" ? "Now" : window;
};

export const formatConfidence = (confidence: number | null | undefined): string => {
  if (typeof confidence !== "number") {
    return "Not available";
  }

  return `${Math.round(confidence * 100)}%`;
};

export const formatReadingLabel = (key: string): string => {
  return READING_LABELS[key] ?? formatLabel(key);
};

export const formatReadingValue = (key: string, value: string | number | null): string => {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  const unit = READING_UNITS[key];
  if (typeof value === "number") {
    const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(1);
    return unit === "%" ? `${formatted}%` : unit ? `${formatted} ${unit}` : formatted;
  }

  return unit === "%" ? `${value}%` : unit ? `${value} ${unit}` : value;
};

export const readingEntries = (readings: Record<string, string | number | null> | undefined) => {
  return Object.entries(readings ?? {}).filter(([, value]) => value !== null && value !== undefined);
};
