import { expectedVersion, json, readJson, route, uuidParam } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { changeStatus } from "@/modules/complaints/service";
import { ChangeStatusInput } from "@/modules/complaints/schemas";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireActor(req);
  const input = await readJson(req, ChangeStatusInput);
  return json(await changeStatus(actor, uuidParam(params.id, "Complaint"), input, expectedVersion(req)));
});
