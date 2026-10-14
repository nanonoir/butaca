export type RateLimitRule = { limit: number; windowMs: number };

export type RateLimiter = {
  /** Records one attempt and returns whether it is still within the rule. */
  consume(key: string, rule: RateLimitRule): boolean;
};

const MAX_TRACKED_KEYS = 10_000;

/**
 * Fixed-window counter in process memory. `auth.api.*` bypasses Better Auth's
 * own HTTP rate limiter, so the application service enforces these limits
 * itself. State is per instance, which matches the single-container
 * deployment; it resets on restart and is not shared across replicas.
 */
export function createRateLimiter(now: () => number = Date.now): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  const evictExpired = (timestamp: number) => {
    for (const [key, entry] of windows) {
      if (entry.resetAt <= timestamp) {
        windows.delete(key);
      }
    }
  };

  return {
    consume(key, rule) {
      const timestamp = now();
      const current = windows.get(key);

      if (!current || current.resetAt <= timestamp) {
        if (!current && windows.size >= MAX_TRACKED_KEYS) {
          evictExpired(timestamp);

          // Still full of live windows: reject new keys instead of growing.
          if (windows.size >= MAX_TRACKED_KEYS) {
            return false;
          }
        }

        windows.set(key, { count: 1, resetAt: timestamp + rule.windowMs });
        return true;
      }

      current.count += 1;
      return current.count <= rule.limit;
    },
  };
}

/** Client address as reported by the reverse proxy. Only meaningful when the
 * proxy overwrites `x-forwarded-for`; otherwise callers share one bucket. */
export function clientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();

  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
