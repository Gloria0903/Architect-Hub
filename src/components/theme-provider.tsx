"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "architect-hub-theme";

interface ThemeContextValue {
  theme: Theme;
  /** The actually-applied theme, resolving "system" to the OS preference. */
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeClass(resolved: "light" | "dark") {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

/**
 * Wraps the app to provide theme state. Doesn't itself prevent the
 * flash of the wrong theme on first paint -- that's handled by the
 * inline script in layout.tsx, which runs before React hydrates and
 * sets the class synchronously from localStorage. This provider picks
 * up from whatever that script already set and keeps things in sync
 * afterward (toggling, listening for OS theme changes when on "system").
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Deferred to a microtask — calling setState synchronously at the
    // top of an effect body trips react-hooks/set-state-in-effect (see
    // the same pattern in notification-bell's polling effect, and
    // document-list.tsx, for the same reason).
    Promise.resolve().then(() => {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      const initial: Theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
      setThemeState(initial);
      setResolvedTheme(initial === "system" ? getSystemPreference() : initial);
    });
  }, []);

  useEffect(() => {
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved = media.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      applyThemeClass(resolved);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    const resolved = next === "system" ? getSystemPreference() : next;
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
