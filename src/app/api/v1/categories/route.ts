import { json, route } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { listCategories } from "@/modules/org/service";

export const GET = route(async (req) => {
  await requireActor(req);
  return json({ data: await listCategories() });
});
