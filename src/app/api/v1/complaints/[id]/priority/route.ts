import { expectedVersion, json, readJson, route, uuidParam } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { changePriority } from "@/modules/complaints/service";
import { ChangePriorityInput } from "@/modules/complaints/schemas";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireActor(req);
  const input = await readJson(req, ChangePriorityInput);
  return json(await changePriority(actor, uuidParam(params.id, "Complaint"), input, expectedVersion(req)));
});
