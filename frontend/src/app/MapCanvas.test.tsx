import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mapConstructor = vi.fn();
const flyTo = vi.fn();
const setStyle = vi.fn();
const setConfigProperty = vi.fn();
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

    flyTo(options: unknown) {
      flyTo(options);
      return this;
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

    remove() {
      return this;
    }
  }

  class MockNavigationControl {}

  return {
    default: {
      accessToken: "",
      Map: MockMap,
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
            show3dObjects: true,
            showPointOfInterestLabels: false,
            showTransitLabels: false,
          },
        },
        center: [35.2433, 38.9637],
        zoom: 5.2,
        pitch: 35,
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

    expect(flyTo).toHaveBeenCalledWith({ center: [32.8597, 39.9334], zoom: 9, pitch: 45 });
    expect(screen.getByLabelText("Selected location crosshair")).toBeInTheDocument();
    expect(screen.getByLabelText("Monitoring radius")).toBeInTheDocument();
  });

  it("switches to standard satellite when the light theme is selected", () => {
    const { rerender } = render(<MapCanvas accessToken="test-mapbox-token" themeMode="dark" />);

    rerender(<MapCanvas accessToken="test-mapbox-token" themeMode="light" />);

    expect(setStyle).toHaveBeenCalledWith("mapbox://styles/mapbox/standard-satellite");
    expect(setConfigProperty).toHaveBeenCalledWith("basemap", "lightPreset", "day");
    expect(setConfigProperty).toHaveBeenCalledWith("basemap", "show3dObjects", true);
  });
});
