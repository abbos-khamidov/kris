/**
 * Framework-agnostic autosave engine (ADR-013).
 *  - debounced writes, one request in flight, always the latest value
 *  - "saved" is reported ONLY after the save function resolved (server confirmed)
 *  - network loss -> "offline", data stays in memory, retried with backoff and on `online`
 *  - version conflict -> "conflict", no further writes until the user resolves it
 */
export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "offline" | "error" | "conflict";

export class SaveError extends Error {
  constructor(
    public code: "conflict" | "network" | "invalid" | "server",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "SaveError";
  }
}

export interface SaverOptions<T> {
  save: (value: T) => Promise<void>;
  onStatus: (status: SaveStatus, message?: string) => void;
  debounceMs?: number;
  isOnline?: () => boolean;
  /** Backoff schedule in ms for network retries. */
  retryDelays?: number[];
}

export interface Saver<T> {
  update(value: T): void;
  /** Saves immediately (e.g. before navigation). Resolves when nothing is pending or saving failed. */
  flush(): Promise<void>;
  /** Called on the browser `online` event or by the "retry" button. */
  retry(): void;
  /** After a conflict has been resolved by the user: continue saving. */
  resume(): void;
  hasPending(): boolean;
  /** Stops timers. Reversible with revive() — React StrictMode mounts, unmounts and re-mounts effects. */
  dispose(): void;
  revive(): void;
}

const isNetworkFailure = (e: unknown) =>
  (e instanceof SaveError && e.code === "network") || e instanceof TypeError;

export function createSaver<T>(opts: SaverOptions<T>): Saver<T> {
  const debounceMs = opts.debounceMs ?? 800;
  const isOnline = opts.isOnline ?? (() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const delays = opts.retryDelays ?? [3000, 6000, 12000, 30000];

  let pending: { value: T } | null = null;
  let inFlight: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let blocked = false; // conflict
  let disposed = false;

  const clearTimers = () => {
    if (timer) clearTimeout(timer);
    if (retryTimer) clearTimeout(retryTimer);
    timer = retryTimer = null;
  };

  async function run(): Promise<void> {
    if (disposed || blocked || inFlight || !pending) return;
    if (!isOnline()) {
      opts.onStatus("offline", "Нет соединения. Изменения сохранятся автоматически, когда связь восстановится.");
      return;
    }
    const job = pending;
    pending = null;
    opts.onStatus("saving");
    inFlight = (async () => {
      try {
        await opts.save(job.value);
        attempt = 0;
        if (!pending) opts.onStatus("saved"); // only now: the server confirmed
      } catch (e) {
        // Keep the unsaved value unless a newer one already replaced it.
        pending ??= job;
        if (e instanceof SaveError && e.code === "conflict") {
          blocked = true;
          opts.onStatus("conflict", e.message);
        } else if (isNetworkFailure(e)) {
          opts.onStatus("offline", "Нет соединения. Изменения сохранятся автоматически, когда связь восстановится.");
          const delay = delays[Math.min(attempt++, delays.length - 1)];
          retryTimer = setTimeout(() => void run(), delay);
        } else {
          opts.onStatus("error", e instanceof Error ? e.message : "Не удалось сохранить");
        }
      } finally {
        inFlight = null;
      }
      // A newer value arrived while saving.
      if (pending && !blocked && !retryTimer && !disposed) await run();
    })();
    return inFlight;
  }

  return {
    update(value) {
      if (disposed) return;
      pending = { value };
      if (!blocked) opts.onStatus("dirty");
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void run();
      }, debounceMs);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (inFlight) await inFlight;
      await run();
      if (inFlight) await inFlight;
    },
    retry() {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      void run();
    },
    resume() {
      blocked = false;
      void run();
    },
    hasPending: () => pending !== null || inFlight !== null,
    dispose() {
      disposed = true;
      clearTimers();
    },
    revive() {
      disposed = false;
      if (pending) void run();
    },
  };
}
