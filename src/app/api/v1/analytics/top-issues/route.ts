import { ForbiddenError } from "@/lib/errors";
import { json, readQuery, route } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { getTopIssues, TopIssuesQuery } from "@/modules/analytics/service";

export const GET = route(async (req) => {
  const actor = await requireActor(req);
  if (actor.role === "STUDENT") throw new ForbiddenError();
  return json({ data: await getTopIssues(actor, readQuery(req, TopIssuesQuery)) });
});
