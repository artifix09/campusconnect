import { json, readJson, route } from "@/lib/http";
import { requireSession } from "@/lib/session";
import { PreferencesInput, updatePreferences } from "@/modules/account/service";

export const PATCH = route(async (req) => {
  const session = await requireSession(req);
  return json(await updatePreferences(session, await readJson(req, PreferencesInput)));
});
