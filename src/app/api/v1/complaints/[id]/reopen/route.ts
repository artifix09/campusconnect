import { json, readJson, route, uuidParam } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { reopenComplaint } from "@/modules/complaints/service";
import { ReopenInput } from "@/modules/complaints/schemas";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireActor(req);
  return json(await reopenComplaint(actor, uuidParam(params.id, "Complaint"), await readJson(req, ReopenInput)));
});
