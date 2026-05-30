export type ViewKey = "monitoring" | "history" | "status";
export type DemoRole = "Forest Officer" | "Disaster Management Official";
export type StatusState = "configured" | "missing" | "unavailable";
export type ThemeMode = "light" | "dark";
export type AssessmentSourceState = "live" | "degraded" | "cached" | "unavailable";

export type ApiStatusPayload = {
  integrations?: {
    openweather?: StatusState;
  };
  runtime?: {
    model_artifact?: {
      state?: StatusState;
    };
  };
};

export type LocationSearchResult = {
  display_name: string;
  latitude: number;
  longitude: number;
  admin: {
    province: string;
    district: string;
    country: string;
  };
  source_label: string;
};

export type LocationSearchPayload = {
  results?: LocationSearchResult[];
  message?: string | null;
};

export type AssessmentWindowResult = {
  forecast_window: string;
  matched_weather_timestamp?: string;
  risk_level: string;
  risk_score: number;
  model_confidence?: number | null;
  risk_trend?: string;
  priority_rank?: string;
  monitoring_radius: string;
  recommended_action: string;
  model_input_drivers?: Record<string, string | number | null>;
  model_explanation?: {
    label?: string;
    method?: string;
    uses_runtime_features_only?: boolean;
    feature_scope?: string[];
    top_feature_impacts?: Array<{
      feature_name: string;
      feature_value: number;
      baseline_value: number;
      contribution_to_risk_score: number;
      direction: "increases_risk" | "decreases_risk" | "neutral";
    }>;
    limitations?: string[];
  };
  weather_signals?: Record<string, string | number | null>;
  narrative_explanation?: string;
  narrative_source_label?: string;
  risk_alert_status?: string;
  runtime_feature_source_state?: string;
};

export type AssessmentPayload = {
  source_state: AssessmentSourceState;
  location?: {
    name: string;
    latitude: number;
    longitude: number;
    source: string;
  };
  forecast_assessments?: AssessmentWindowResult[];
  data_source_labels?: {
    assessment?: string;
    weather?: string;
    narrative?: string;
  };
  message?: string | null;
};

export type ActiveRiskAlert = {
  id: string;
  created_at: string;
  expires_at: string;
  status: string;
  recommendation_rule_version: string;
  location_name: string;
  latitude: number;
  longitude: number;
  forecast_window: string;
  risk_level: string;
  risk_score: number;
  recommended_action: string;
  alert_text: string;
};

export type MonitoringOverviewPayload = {
  source_state: "demo" | "live" | "degraded";
  monitoring_locations: Array<{
    name: string;
    latitude: number;
    longitude: number;
  }>;
  predicted_risk_hotspots: Array<{
    name: string;
    latitude: number;
    longitude: number;
    risk_level: string;
    data_source_label: string;
    label: string;
  }>;
  regional_summaries: Array<{
    region: string;
    risk_level: string;
    data_source_label: string;
  }>;
  top_priority_regions: Array<{
    region: string;
    priority_rank: string;
    data_source_label: string;
  }>;
  data_source_labels?: {
    overview?: string;
    hotspots?: string;
    regional_summary?: string;
    top_priority_regions?: string;
  };
  message?: string | null;
};

export type PredictionHistoryRecord = {
  id: string;
  assessment_timestamp: string;
  source_state: AssessmentSourceState;
  location: {
    name?: string | null;
    latitude: number;
    longitude: number;
    source?: string | null;
  };
  requested_forecast_windows: string[];
  data_source_labels?: {
    assessment?: string;
    weather?: string;
    narrative?: string;
  };
  forecast_assessments: AssessmentWindowResult[];
};

export const VIEWS: Record<ViewKey, string> = {
  monitoring: "Monitoring Dashboard",
  history: "Prediction History",
  status: "Model And Data Status",
};

export const THEME_STORAGE_KEY = "firewatch-theme";
export const ASSESSMENT_WINDOWS = ["now", "24h", "48h", "72h"];

export const READING_LABELS: Record<string, string> = {
  temperature_c: "Temperature",
  temperature_min_c: "Minimum temperature",
  temperature_max_c: "Maximum temperature",
  rain_mm: "Rainfall",
  wind_speed_mps: "Wind speed",
  wind_gust_mps: "Wind gust",
  humidity_pct: "Humidity",
  pressure_hpa: "Pressure",
  cloud_cover_pct: "Cloud cover",
  visibility_m: "Visibility",
  weather_description: "Weather",
  precipitation_probability_pct: "Precipitation probability",
};

export const READING_UNITS: Record<string, string> = {
  temperature_c: "C",
  temperature_min_c: "C",
  temperature_max_c: "C",
  rain_mm: "mm",
  wind_speed_mps: "m/s",
  wind_gust_mps: "m/s",
  humidity_pct: "%",
  pressure_hpa: "hPa",
  cloud_cover_pct: "%",
  visibility_m: "m",
  precipitation_probability_pct: "%",
};
