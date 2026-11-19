import "server-only";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

async function probe(check: () => Promise<unknown>) {
  const started = performance.now();
  try {
    await check();
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.name : "Error" };
  }
}

export async function deepHealth() {
  const [database, objectStorage] = await Promise.all([
    probe(() => db.$queryRaw`SELECT 1`),
    probe(() => storage.ping()),
  ]);
  return { ok: database.ok && objectStorage.ok, database, storage: objectStorage };
}

export const appVersion = () => process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.npm_package_version ?? "dev";
