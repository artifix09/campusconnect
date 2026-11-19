import { json, readQuery, route } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { ListNotificationsQuery, listNotifications } from "@/modules/notifications/service";

export const GET = route(async (req) => {
  const actor = await requireActor(req);
  return json(await listNotifications(actor, readQuery(req, ListNotificationsQuery)));
});
