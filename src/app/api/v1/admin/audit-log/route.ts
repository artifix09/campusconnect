import { json, readQuery, route } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { AuditQuery, listAuditLog } from "@/modules/org/service";

export const GET = route(async (req) => {
  const actor = await requireActor(req);
  return json(await listAuditLog(actor, readQuery(req, AuditQuery)));
});
