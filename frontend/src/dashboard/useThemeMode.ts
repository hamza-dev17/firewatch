import { useEffect, useState } from "react";

import { THEME_STORAGE_KEY, type ThemeMode } from "./types";

const getSavedTheme = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "dark";
  }

  return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
};

export const useThemeMode = () => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getSavedTheme);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  return { themeMode, setThemeMode };
};
