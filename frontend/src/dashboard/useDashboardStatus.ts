import { useEffect, useState } from "react";

import type { ApiStatusPayload, StatusState } from "./types";

export const useDashboardStatus = () => {
  const [weatherState, setWeatherState] = useState<StatusState>("unavailable");
  const [modelState, setModelState] = useState<StatusState>("unavailable");

  useEffect(() => {
    const controller = new AbortController();

    const loadStatus = async () => {
      try {
        const response = await fetch("/api/status", { signal: controller.signal });
        if (!response.ok) {
          setWeatherState("unavailable");
          setModelState("unavailable");
          return;
        }

        const payload = (await response.json()) as ApiStatusPayload;
        setWeatherState(payload.integrations?.openweather ?? "unavailable");
        setModelState(payload.runtime?.model_artifact?.state ?? "unavailable");
      } catch {
        setWeatherState("unavailable");
        setModelState("unavailable");
      }
    };

    void loadStatus();

    return () => controller.abort();
  }, []);

  return { weatherState, modelState };
};
