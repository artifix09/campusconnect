import { json, readQuery, route } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { getSummary, RangeQuery } from "@/modules/analytics/service";

export const GET = route(async (req) => {
  const actor = await requireActor(req);
  return json(await getSummary(actor, readQuery(req, RangeQuery)));
});
