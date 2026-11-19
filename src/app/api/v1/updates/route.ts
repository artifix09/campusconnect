import { json, route } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { changeStamp } from "@/modules/live/service";

/** Polled by open pages; when the stamp changes they refresh their data. */
export const GET = route(async (req) => {
  const actor = await requireActor(req, { allowIncompleteSetup: true });
  return json({ stamp: await changeStamp(actor) });
});
