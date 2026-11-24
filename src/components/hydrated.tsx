"use client";
import { useEffect } from "react";

/** Marks the document once React has hydrated, so automated tests never click before handlers exist. */
export function Hydrated() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "1";
  }, []);
  return null;
}
