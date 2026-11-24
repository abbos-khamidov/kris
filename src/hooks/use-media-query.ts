"use client";
import { useSyncExternalStore } from "react";

/** SSR-safe media query (server snapshot = false, so the mobile layout is the hydration baseline). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
