"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSaver, type SaveStatus, type Saver } from "@/lib/autosave";

/** React binding for the autosave engine: online/offline events + unsaved-changes warning. */
export function useAutosave<T>(save: (value: T) => Promise<void>, debounceMs = 800) {
  const [state, setState] = useState<{ status: SaveStatus; message?: string }>({ status: "idle" });
  const saveRef = useRef(save);
  saveRef.current = save;

  const saver: Saver<T> = useMemo(
    () =>
      createSaver<T>({
        save: (v) => saveRef.current(v),
        onStatus: (status, message) => setState({ status, message }),
        debounceMs,
      }),
    [debounceMs],
  );

  useEffect(() => {
    saver.revive();
    const onOnline = () => saver.retry();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saver.hasPending()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden" && saver.hasPending()) void saver.flush();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onHide);
      saver.dispose();
    };
  }, [saver]);

  const update = useCallback((v: T) => saver.update(v), [saver]);
  return { ...state, update, flush: saver.flush, retry: saver.retry, resume: saver.resume, hasPending: saver.hasPending };
}
