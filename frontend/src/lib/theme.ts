"use client";

import { create } from "zustand";

type Theme = "dark" | "light" | "system";

interface ThemeState {
  theme: Theme;
  resolved: "dark" | "light";
  setTheme: (theme: Theme) => void;
}

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolve(theme: Theme): "dark" | "light" {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyTheme(resolved: "dark" | "light") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(resolved);
}

function loadSaved(): Theme {
  if (typeof localStorage === "undefined") return "dark";
  return (localStorage.getItem("launchpadai-theme") as Theme) || "dark";
}

export const useTheme = create<ThemeState>((set) => {
  const initial = loadSaved();
  const res = resolve(initial);

  if (typeof window !== "undefined") {
    setTimeout(() => applyTheme(res), 0);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      const current = useTheme.getState();
      if (current.theme === "system") {
        const newResolved = getSystemTheme();
        applyTheme(newResolved);
        set({ resolved: newResolved });
      }
    });
  }

  return {
    theme: initial,
    resolved: res,
    setTheme: (theme: Theme) => {
      const res = resolve(theme);
      localStorage.setItem("launchpadai-theme", theme);
      applyTheme(res);
      set({ theme, resolved: res });
    },
  };
});
