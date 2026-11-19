import { json, readJson, route, uuidParam } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { UpdateUserInput, updateUser } from "@/modules/org/service";

/** Activate or deactivate (ends all sessions immediately), rename, or move a department admin. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireActor(req);
  return json(await updateUser(actor, uuidParam(params.id, "User"), await readJson(req, UpdateUserInput)));
});
