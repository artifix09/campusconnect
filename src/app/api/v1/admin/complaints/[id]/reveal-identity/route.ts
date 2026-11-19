import { json, readJson, route, uuidParam } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { revealIdentity } from "@/modules/complaints/service";
import { RevealIdentityInput } from "@/modules/complaints/schemas";

/** Super Admin only. The reason is stored in the audit log and on the complaint timeline. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireActor(req);
  const student = await revealIdentity(actor, uuidParam(params.id, "Complaint"), await readJson(req, RevealIdentityInput));
  return json({ student });
});
