import { json, readQuery, route } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { getTrend, TrendQuery } from "@/modules/analytics/service";

export const GET = route(async (req) => {
  const actor = await requireActor(req);
  return json({ data: await getTrend(actor, readQuery(req, TrendQuery)) });
});
