import { created, json, readJson, route, uuidParam } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { addComment, listComments } from "@/modules/complaints/service";
import { CommentInput } from "@/modules/complaints/schemas";

/** Students never receive internal staff notes. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireActor(req);
  return json({ data: await listComments(actor, uuidParam(params.id, "Complaint")) });
});

export const POST = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireActor(req);
  return created(await addComment(actor, uuidParam(params.id, "Complaint"), await readJson(req, CommentInput)));
});
