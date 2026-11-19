import { json, readJson, route } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { MarkReadInput, markNotificationsRead } from "@/modules/notifications/service";

export const POST = route(async (req) => {
  const actor = await requireActor(req);
  return json(await markNotificationsRead(actor, await readJson(req, MarkReadInput)));
});
