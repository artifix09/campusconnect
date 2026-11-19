import { json, readJson, route, uuidParam } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { withdrawComplaint } from "@/modules/complaints/service";
import { WithdrawInput } from "@/modules/complaints/schemas";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireActor(req);
  return json(await withdrawComplaint(actor, uuidParam(params.id, "Complaint"), await readJson(req, WithdrawInput)));
});
