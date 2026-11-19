import { json, readQuery, route } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { getByStatus, RangeQuery } from "@/modules/analytics/service";

export const GET = route(async (req) => {
  const actor = await requireActor(req);
  return json({ data: await getByStatus(actor, readQuery(req, RangeQuery)) });
});
