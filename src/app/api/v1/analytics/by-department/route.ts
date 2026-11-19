import { ForbiddenError } from "@/lib/errors";
import { json, readQuery, route } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { getByDepartment, RangeQuery } from "@/modules/analytics/service";

export const GET = route(async (req) => {
  const actor = await requireActor(req);
  if (actor.role === "STUDENT") throw new ForbiddenError();
  return json({ data: await getByDepartment(actor, readQuery(req, RangeQuery)) });
});
