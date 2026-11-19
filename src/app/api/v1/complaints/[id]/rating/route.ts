import { json, readJson, route, uuidParam } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { rateComplaint } from "@/modules/complaints/service";
import { RatingInput } from "@/modules/complaints/schemas";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireActor(req);
  return json(await rateComplaint(actor, uuidParam(params.id, "Complaint"), await readJson(req, RatingInput)));
});
