"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSaver, type SaveStatus, type Saver } from "@/lib/autosave";

/** React binding for the autosave engine: online/offline events + unsaved-changes warning. */
export function useAutosave<T>(save: (value: T) => Promise<void>, debounceMs = 800) {
  const [state, setState] = useState<{ status: SaveStatus; message?: string }>({ status: "idle" });
  // "Latest ref" pattern: the engine always calls the newest `save`, and only from timers/handlers.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  const saver: Saver<T> = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- the closure is invoked later by the saver's timers, never during render
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
