"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { loadThemeAction, saveThemeAction } from "@/app/(app)/settings/theme-actions";
import { DEFAULT_PREFS, STORAGE_KEY, buildTheme, resolveDark, type BuiltTheme, type ThemePrefs } from "@/lib/theme";

interface Ctx {
  prefs: ThemePrefs;
  built: BuiltTheme;
  dark: boolean;
  /** Applies instantly, then saves to the account (synced across devices). */
  update: (patch: Partial<ThemePrefs>) => void;
  reset: () => void;
}
const ThemeCtx = createContext<Ctx | null>(null);

export function useAppTheme(): Ctx {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error("useAppTheme outside ThemeProvider");
  return c;
}

/** For components that may render outside the app shell (e.g. the toaster on the login page). */
export function useOptionalTheme(): "light" | "dark" {
  return useSyncExternalStore(
    (cb) => {
      const o = new MutationObserver(cb);
      o.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => o.disconnect();
    },
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "light",
  );
}

const same = (a: ThemePrefs, b: ThemePrefs) => a.palette === b.palette && a.custom.toLowerCase() === b.custom.toLowerCase() && a.mode === b.mode;

function apply(prefs: ThemePrefs): boolean {
  const built = buildTheme(prefs);
  const dark = resolveDark(prefs.mode, window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  const tokens = dark ? built.dark : built.light;
  for (const [k, v] of Object.entries(tokens)) root.style.setProperty(k, v);
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ prefs, light: built.light, dark: built.dark }));
  } catch {
    /* private mode: the account copy still applies */
  }
  return dark;
}

export function ThemeProvider({ initial, children }: { initial: ThemePrefs | null; children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<ThemePrefs>(initial ?? DEFAULT_PREFS);
  const [dark, setDark] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const built = useMemo(() => buildTheme(prefs), [prefs]);

  useEffect(() => setDark(apply(prefs)), [prefs]);

  // "system" mode follows the OS live.
  useEffect(() => {
    if (prefs.mode !== "system") return;
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setDark(apply(prefs));
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [prefs]);

  // Pick up a theme changed on another device when this tab becomes visible again.
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      const r = await loadThemeAction();
      if (r.ok) setPrefs((cur) => (same(cur, r.data) ? cur : r.data));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const persist = useCallback((next: ThemePrefs) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveThemeAction(next), 500);
  }, []);

  const update = useCallback(
    (patch: Partial<ThemePrefs>) => {
      setPrefs((cur) => {
        const next = { ...cur, ...patch };
        persist(next);
        return next;
      });
    },
    [persist],
  );
  const reset = useCallback(() => {
    setPrefs(DEFAULT_PREFS);
    persist(DEFAULT_PREFS);
  }, [persist]);

  return <ThemeCtx.Provider value={{ prefs, built, dark, update, reset }}>{children}</ThemeCtx.Provider>;
}
