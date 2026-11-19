import "server-only";
import { after } from "next/server";
import { logger } from "./logger";

/**
 * Runs work after the response has been sent (Next.js `after`). Outside a
 * request (scripts, cron edge cases) it falls back to fire-and-forget.
 * Failures are only logged: anything important is also persisted and retried
 * by a cron job, so losing a background run never loses data.
 */
export function runAfterResponse(label: string, task: () => Promise<unknown>) {
  const guarded = async () => {
    try {
      await task();
    } catch (error) {
      logger.error({ err: error, task: label }, "Background task failed");
    }
  };
  try {
    after(guarded);
  } catch {
    void guarded();
  }
}
