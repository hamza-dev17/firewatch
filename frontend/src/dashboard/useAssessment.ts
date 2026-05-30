import { useState } from "react";

import {
  ASSESSMENT_WINDOWS,
  type AssessmentPayload,
  type LocationSearchResult,
} from "./types";

const degradedAssessmentPayload: AssessmentPayload = {
  source_state: "degraded",
  forecast_assessments: [],
  data_source_labels: {
    assessment: "unavailable",
    weather: "unavailable",
    narrative: "unavailable",
  },
  message: "Assessment service is unavailable.",
};

const withMessage = (message: string | null | undefined): AssessmentPayload => ({
  ...degradedAssessmentPayload,
  message: message?.trim() ? message : degradedAssessmentPayload.message,
});

export const useAssessment = () => {
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null);
  const [assessmentPayload, setAssessmentPayload] = useState<AssessmentPayload | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);

  const selectLocationForAssessment = async (
    location: LocationSearchResult,
    onStart?: () => void
  ) => {
    setSelectedLocation(location);
    setAssessmentPayload(null);
    onStart?.();
    setIsAssessing(true);

    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: {
            name: location.display_name,
            latitude: location.latitude,
            longitude: location.longitude,
            source: location.source_label,
          },
          forecast_windows: ASSESSMENT_WINDOWS,
        }),
      });

      if (!response.ok) {
        try {
          const errorPayload = (await response.json()) as Partial<AssessmentPayload>;
          setAssessmentPayload(withMessage(errorPayload.message));
        } catch {
          setAssessmentPayload(degradedAssessmentPayload);
        }
        return;
      }

      setAssessmentPayload((await response.json()) as AssessmentPayload);
    } catch {
      setAssessmentPayload(degradedAssessmentPayload);
    } finally {
      setIsAssessing(false);
    }
  };

  return {
    selectedLocation,
    assessmentPayload,
    isAssessing,
    selectLocationForAssessment,
  };
};
