import { json, route } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { listDepartments } from "@/modules/org/service";

export const GET = route(async (req) => {
  const actor = await requireActor(req);
  return json({ data: await listDepartments(actor) });
});
