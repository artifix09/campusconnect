import { created, json, readJson, route } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { CategoryInput, createCategory, listAllCategories } from "@/modules/org/service";

/** Categories are the routing table: each one points at the department that handles it. */
export const GET = route(async (req) => {
  const actor = await requireActor(req);
  return json({ data: await listAllCategories(actor) });
});

export const POST = route(async (req) => {
  const actor = await requireActor(req);
  return created(await createCategory(actor, await readJson(req, CategoryInput)));
});
