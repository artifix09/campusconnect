import { json, route, uuidParam } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { getComplaint } from "@/modules/complaints/service";

/** Returns 403 (and writes an audit entry) when the complaint exists but is outside the caller's scope. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireActor(req);
  return json(await getComplaint(actor, uuidParam(params.id, "Complaint")));
});
