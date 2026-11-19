import { ValidationError } from "@/lib/errors";
import { created, json, parse, readJson, readQuery, route } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { createComplaint, listComplaints } from "@/modules/complaints/service";
import { CreateComplaintInput, IdempotencyKey, ListComplaintsQuery } from "@/modules/complaints/schemas";

/** Lists complaints in the caller's scope: own (student), own department (admin) or all (super admin). */
export const GET = route(async (req) => {
  const actor = await requireActor(req);
  return json(await listComplaints(actor, readQuery(req, ListComplaintsQuery)));
});

/** Files a complaint. The department is derived from the category on the server. */
export const POST = route(async (req) => {
  const actor = await requireActor(req);
  const key = req.headers.get("idempotency-key");
  if (!key) throw new ValidationError("The Idempotency-Key header is required.");
  const input = await readJson(req, CreateComplaintInput);

  const { complaint, replayed } = await createComplaint(actor, input, parse(IdempotencyKey, key));
  return replayed ? json(complaint) : created(complaint, `/api/v1/complaints/${complaint.id}`);
});
