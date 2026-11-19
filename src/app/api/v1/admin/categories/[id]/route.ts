import { json, readJson, route, uuidParam } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { CategoryUpdate, updateCategory } from "@/modules/org/service";

/** Changing departmentId re-routes future complaints only. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireActor(req);
  return json(await updateCategory(actor, uuidParam(params.id, "Category"), await readJson(req, CategoryUpdate)));
});
