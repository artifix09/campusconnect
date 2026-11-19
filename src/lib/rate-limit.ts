import "server-only";
import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "./env";
import { RateLimitedError } from "./errors";
import { logger } from "./logger";

/** Limits from docs/03 ADR-014. */
export const RATE_LIMITS = {
  createComplaint: { limit: 10, window: "1 d" },
  uploadImage: { limit: 30, window: "1 h" },
  comment: { limit: 30, window: "1 h" },
  support: { limit: 60, window: "1 h" },
  export: { limit: 20, window: "1 h" },
} as const satisfies Record<string, { limit: number; window: Duration }>;

export type RateLimitRule = keyof typeof RATE_LIMITS;

type Result = { success: boolean; reset: number };

interface Limiter {
  check(rule: RateLimitRule, key: string): Promise<Result>;
}

class UpstashLimiter implements Limiter {
  private readonly limiters = new Map<RateLimitRule, Ratelimit>();
  constructor(private readonly redis: Redis) {}

  async check(rule: RateLimitRule, key: string): Promise<Result> {
    let limiter = this.limiters.get(rule);
    if (!limiter) {
      const { limit, window } = RATE_LIMITS[rule];
      limiter = new Ratelimit({ redis: this.redis, limiter: Ratelimit.slidingWindow(limit, window), prefix: `cc:${rule}` });
      this.limiters.set(rule, limiter);
    }
    const { success, reset } = await limiter.limit(key);
    return { success, reset };
  }
}

/** Single-instance fallback for local development and tests only. */
class MemoryLimiter implements Limiter {
  private readonly hits = new Map<string, number[]>();

  async check(rule: RateLimitRule, key: string): Promise<Result> {
    const { limit, window } = RATE_LIMITS[rule];
    const windowMs = durationToMs(window);
    const now = Date.now();
    const id = `${rule}:${key}`;
    const recent = (this.hits.get(id) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      return { success: false, reset: (recent[0] ?? now) + windowMs };
    }
    recent.push(now);
    this.hits.set(id, recent);
    return { success: true, reset: now + windowMs };
  }
}

function durationToMs(duration: Duration): number {
  const [amount, unit] = duration.split(" ") as [string, string];
  const factor: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(amount) * (factor[unit] ?? 1000);
}

const limiter: Limiter =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new UpstashLimiter(new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }))
    : new MemoryLimiter();

/** Throws RateLimitedError when `key` has used up its allowance for `rule`. */
export async function enforceRateLimit(rule: RateLimitRule, key: string): Promise<void> {
  let result: Result;
  try {
    result = await limiter.check(rule, key);
  } catch (error) {
    // Fail open: a Redis outage must not take complaint filing down with it.
    logger.warn({ err: error, rule }, "Rate limiter unavailable");
    return;
  }
  if (!result.success) {
    throw new RateLimitedError(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)));
  }
}
