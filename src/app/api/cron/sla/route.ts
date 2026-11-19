import { env } from "@/lib/env";
import { assertBearer } from "@/lib/cron";
import { json, route } from "@/lib/http";
import { runSlaCheck } from "@/modules/jobs/service";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  assertBearer(req, env.CRON_SECRET);
  return json(await runSlaCheck());
});
