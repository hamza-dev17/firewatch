import type { DemoRole } from "../../dashboard/types";

export const OPERATOR_PROFILE_STORAGE_KEY = "firewatch-operator-profile";

export type OperatorProfile = {
  displayName: string;
  email: string;
  phone: string;
  badge: string;
  bio: string;
  role: DemoRole;
  region: string;
  station: string;
  shift: string;
  language: string;
  timezone: string;
  alertSound: boolean;
  emailAlerts: boolean;
  smsAlerts: boolean;
  highContrastMap: boolean;
  autoRefresh: number;
};

export const DEFAULT_OPERATOR_PROFILE: OperatorProfile = {
  displayName: "Hamza Karakus",
  email: "hamza.karakus@ogm.gov.tr",
  phone: "+90 555 123 4567",
  badge: "OGM-2847",
  bio: "Senior Forest Officer - Mugla OBM district, specialising in Aegean/Mediterranean fire risk assessment.",
  role: "Forest Officer",
  region: "Aegean / Mediterranean",
  station: "Mugla OBM",
  shift: "Day Shift (06:00 - 18:00)",
  language: "English",
  timezone: "Europe/Istanbul (UTC+3)",
  alertSound: true,
  emailAlerts: true,
  smsAlerts: false,
  highContrastMap: false,
  autoRefresh: 30,
};

const isDemoRole = (value: unknown): value is DemoRole =>
  value === "Forest Officer" || value === "Disaster Management Official";

const parseBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const parseNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const parseString = (value: unknown, fallback: string) =>
  typeof value === "string" ? value : fallback;

export const normalizeOperatorProfile = (value: unknown): OperatorProfile => {
  if (!value || typeof value !== "object") return DEFAULT_OPERATOR_PROFILE;

  const candidate = value as Partial<Record<keyof OperatorProfile, unknown>>;

  return {
    displayName: parseString(candidate.displayName, DEFAULT_OPERATOR_PROFILE.displayName),
    email: parseString(candidate.email, DEFAULT_OPERATOR_PROFILE.email),
    phone: parseString(candidate.phone, DEFAULT_OPERATOR_PROFILE.phone),
    badge: parseString(candidate.badge, DEFAULT_OPERATOR_PROFILE.badge),
    bio: parseString(candidate.bio, DEFAULT_OPERATOR_PROFILE.bio),
    role: isDemoRole(candidate.role) ? candidate.role : DEFAULT_OPERATOR_PROFILE.role,
    region: parseString(candidate.region, DEFAULT_OPERATOR_PROFILE.region),
    station: parseString(candidate.station, DEFAULT_OPERATOR_PROFILE.station),
    shift: parseString(candidate.shift, DEFAULT_OPERATOR_PROFILE.shift),
    language: parseString(candidate.language, DEFAULT_OPERATOR_PROFILE.language),
    timezone: parseString(candidate.timezone, DEFAULT_OPERATOR_PROFILE.timezone),
    alertSound: parseBoolean(candidate.alertSound, DEFAULT_OPERATOR_PROFILE.alertSound),
    emailAlerts: parseBoolean(candidate.emailAlerts, DEFAULT_OPERATOR_PROFILE.emailAlerts),
    smsAlerts: parseBoolean(candidate.smsAlerts, DEFAULT_OPERATOR_PROFILE.smsAlerts),
    highContrastMap: parseBoolean(candidate.highContrastMap, DEFAULT_OPERATOR_PROFILE.highContrastMap),
    autoRefresh: parseNumber(candidate.autoRefresh, DEFAULT_OPERATOR_PROFILE.autoRefresh),
  };
};

export const loadOperatorProfile = (): OperatorProfile => {
  if (typeof window === "undefined") return DEFAULT_OPERATOR_PROFILE;

  try {
    const storedProfile = window.localStorage.getItem(OPERATOR_PROFILE_STORAGE_KEY);
    if (!storedProfile) return DEFAULT_OPERATOR_PROFILE;
    return normalizeOperatorProfile(JSON.parse(storedProfile));
  } catch {
    return DEFAULT_OPERATOR_PROFILE;
  }
};

export const saveOperatorProfile = (profile: OperatorProfile) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OPERATOR_PROFILE_STORAGE_KEY, JSON.stringify(profile));
};

export const getOperatorInitials = (name: string) => {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "OP";
};
