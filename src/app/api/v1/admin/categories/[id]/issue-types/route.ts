import { created, readJson, route, uuidParam } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { IssueTypeInput, addIssueType } from "@/modules/org/service";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireActor(req);
  return created(await addIssueType(actor, uuidParam(params.id, "Category"), await readJson(req, IssueTypeInput)));
});
