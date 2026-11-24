import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SaveError, createSaver, type SaveStatus } from "../src/lib/autosave";

const setup = (save: (v: string) => Promise<void>, online = () => true) => {
  const statuses: SaveStatus[] = [];
  const saver = createSaver<string>({ save, onStatus: (s) => statuses.push(s), debounceMs: 100, isOnline: online, retryDelays: [500] });
  return { saver, statuses };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("autosave", () => {
  it("debounces and reports saved only after the server confirmed", async () => {
    let resolve!: () => void;
    const save = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const { saver, statuses } = setup(save);
    saver.update("a");
    saver.update("ab");
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("ab");
    expect(statuses).not.toContain("saved"); // request still in flight
    resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(statuses.at(-1)).toBe("saved");
  });

  it("saves the newest value that arrived while a request was in flight", async () => {
    const calls: string[] = [];
    const resolvers: (() => void)[] = [];
    const save = vi.fn((v: string) => {
      calls.push(v);
      return new Promise<void>((r) => resolvers.push(r));
    });
    const { saver, statuses } = setup(save);
    saver.update("one");
    await vi.advanceTimersByTimeAsync(100);
    saver.update("two");
    await vi.advanceTimersByTimeAsync(100);
    resolvers[0]();
    await vi.advanceTimersByTimeAsync(0);
    expect(statuses.at(-1)).not.toBe("saved"); // "two" is still unsaved
    resolvers[1]?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(["one", "two"]);
    expect(statuses.at(-1)).toBe("saved");
  });

  it("goes offline on network failure, keeps the value and retries", async () => {
    const save = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValue(undefined);
    const { saver, statuses } = setup(save);
    saver.update("x");
    await vi.advanceTimersByTimeAsync(100);
    expect(statuses.at(-1)).toBe("offline");
    expect(saver.hasPending()).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("x");
    expect(statuses.at(-1)).toBe("saved");
  });

  it("does not call save while the browser is offline, and saves after retry()", async () => {
    let online = false;
    const save = vi.fn().mockResolvedValue(undefined);
    const { saver, statuses } = setup(save, () => online);
    saver.update("y");
    await vi.advanceTimersByTimeAsync(100);
    expect(save).not.toHaveBeenCalled();
    expect(statuses.at(-1)).toBe("offline");
    online = true;
    saver.retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledWith("y");
    expect(statuses.at(-1)).toBe("saved");
  });

  it("stops on conflict until resumed", async () => {
    const save = vi.fn().mockRejectedValueOnce(new SaveError("conflict")).mockResolvedValue(undefined);
    const { saver, statuses } = setup(save);
    saver.update("a");
    await vi.advanceTimersByTimeAsync(100);
    expect(statuses.at(-1)).toBe("conflict");
    saver.update("b");
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
    saver.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenLastCalledWith("b");
    expect(statuses.at(-1)).toBe("saved");
  });

  it("flush() saves immediately", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { saver } = setup(save);
    saver.update("z");
    await saver.flush();
    expect(save).toHaveBeenCalledWith("z");
    expect(saver.hasPending()).toBe(false);
  });
});

describe("autosave lifecycle", () => {
  it("keeps working after dispose() + revive() (React StrictMode remount)", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { saver, statuses } = setup(save);
    saver.dispose();
    saver.revive();
    saver.update("after-remount");
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledWith("after-remount");
    expect(statuses.at(-1)).toBe("saved");
  });
});
