"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "savora-theme";

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function getTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function getServerTheme() {
  return "dark";
}

function subscribe(listener) {
  window.addEventListener("savora-theme-change", listener);
  return () => window.removeEventListener("savora-theme-change", listener);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);

  const toggleTheme = useCallback(() => {
    const nextTheme = getTheme() === "light" ? "dark" : "light";
    applyTheme(nextTheme);

    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // The theme still works when storage is unavailable.
    }

    window.dispatchEvent(new Event("savora-theme-change"));
  }, []);

  return { theme, toggleTheme, isLight: theme === "light" };
}

export default useTheme;
