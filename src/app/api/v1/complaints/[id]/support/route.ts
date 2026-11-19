import { json, route, uuidParam } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { supportComplaint, unsupportComplaint } from "@/modules/complaints/service";

/** "Me too": a student supports an open complaint filed by someone else. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireActor(req);
  return json(await supportComplaint(actor, uuidParam(params.id, "Complaint")));
});

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireActor(req);
  return json(await unsupportComplaint(actor, uuidParam(params.id, "Complaint")));
});
