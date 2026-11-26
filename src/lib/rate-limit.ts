/**
 * Sliding-window limiter kept in the memory of one server instance. It stops runaway clicking and
 * stuck loops; it is not a global quota (serverless instances do not share it).
 */
export function createRateLimiter(rules: { limit: number; windowMs: number }[]) {
  const hits = new Map<string, number[]>();
  const longest = Math.max(...rules.map((r) => r.windowMs));
  /** Returns 0 when allowed (and counts the call), otherwise the seconds to wait. */
  return (key: string, now = Date.now()): number => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < longest);
    hits.set(key, recent);
    for (const { limit, windowMs } of rules) {
      const inWindow = recent.filter((t) => now - t < windowMs);
      if (inWindow.length >= limit) return Math.max(1, Math.ceil((inWindow[inWindow.length - limit] + windowMs - now) / 1000));
    }
    recent.push(now);
    return 0;
  };
}
