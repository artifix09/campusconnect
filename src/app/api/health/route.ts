import { env } from "@/lib/env";
import { assertBearer } from "@/lib/cron";
import { json, route } from "@/lib/http";
import { appVersion, deepHealth } from "@/modules/health/service";

export const dynamic = "force-dynamic";

/** Liveness for the uptime monitor. With ?deep=1 and HEALTH_SECRET it also checks the database and storage. */
export const GET = route(async (req) => {
  if (req.nextUrl.searchParams.get("deep") !== "1") {
    return json({ status: "ok", version: appVersion() });
  }
  assertBearer(req, env.HEALTH_SECRET);
  const health = await deepHealth();
  return json({ status: health.ok ? "ok" : "degraded", version: appVersion(), ...health }, { status: health.ok ? 200 : 503 });
});
