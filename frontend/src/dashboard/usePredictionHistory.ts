import { useCallback, useState } from "react";

import type { PredictionHistoryPayload, PredictionHistoryRecord } from "./types";

export type HistoryFilters = {
  region?: string;
  startDate?: string;
  endDate?: string;
  riskLevel?: string;
  showArchived?: boolean;
};

const buildHistoryUrl = (filters: HistoryFilters = {}) => {
  const params = new URLSearchParams();

  if (filters.region) {
    params.set("region", filters.region);
  }
  if (filters.startDate) {
    params.set("start_date", filters.startDate);
  }
  if (filters.endDate) {
    params.set("end_date", filters.endDate);
  }
  if (filters.riskLevel) {
    params.set("risk_level", filters.riskLevel);
  }
  if (filters.showArchived) {
    params.set("show_archived", "true");
  }

  const query = params.toString();
  return query ? `/api/history?${query}` : "/api/history";
};

export const usePredictionHistory = () => {
  const [records, setRecords] = useState<PredictionHistoryRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFilters, setLastFilters] = useState<HistoryFilters>({});

  const loadHistory = useCallback(async (filters: HistoryFilters = {}) => {
    setLastFilters(filters);
    setIsLoading(true);
    try {
      const response = await fetch(buildHistoryUrl(filters));
      if (!response.ok) {
        setRecords([]);
        setMessage("Prediction history is unavailable.");
        return;
      }

      const payload = (await response.json()) as PredictionHistoryPayload;
      setRecords(payload.records ?? []);
      setMessage(payload.message ?? null);
    } catch {
      setRecords([]);
      setMessage("Prediction history is unavailable.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const archiveRecord = useCallback(
    async (recordId: string) => {
      const response = await fetch(`/api/history/${recordId}/archive`, { method: "POST" });
      if (!response.ok) {
        setMessage("Prediction history record could not be archived.");
        return;
      }

      await loadHistory(lastFilters);
    },
    [lastFilters, loadHistory]
  );

  return { records, message, isLoading, loadHistory, archiveRecord };
};
