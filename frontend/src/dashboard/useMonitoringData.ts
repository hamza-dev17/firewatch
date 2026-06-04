import { useCallback, useEffect, useState } from "react";

import type { ActiveRiskAlert, MonitoringOverviewPayload } from "./types";

type ActiveAlertsPayload = {
  alerts?: ActiveRiskAlert[];
};

export const useMonitoringData = () => {
  const [overview, setOverview] = useState<MonitoringOverviewPayload | null>(null);
  const [alerts, setAlerts] = useState<ActiveRiskAlert[]>([]);

  const loadMonitoringData = useCallback(async () => {
    const loadLatestMonitoringData = async () => {
      const [overviewResult, alertsResult] = await Promise.allSettled([
        fetch("/api/monitoring/overview"),
        fetch("/api/alerts/active"),
      ]);

      if (overviewResult.status === "fulfilled" && overviewResult.value.ok) {
        setOverview(await overviewResult.value.json());
      }

      if (alertsResult.status === "fulfilled" && alertsResult.value.ok) {
        const payload: ActiveAlertsPayload = await alertsResult.value.json();
        setAlerts(payload.alerts ?? []);
      }
    };

    await loadLatestMonitoringData();

    const refreshResult = await fetch("/api/monitoring/refresh", { method: "POST" }).catch(() => null);
    if (refreshResult?.ok) {
      await loadLatestMonitoringData();
    }
  }, []);

  useEffect(() => {
    void loadMonitoringData();
  }, [loadMonitoringData]);

  return { alerts, overview, refreshMonitoringData: loadMonitoringData };
};
