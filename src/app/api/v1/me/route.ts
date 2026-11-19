import { json, route } from "@/lib/http";
import { requireSession } from "@/lib/session";
import { getProfile } from "@/modules/account/service";

// Allowed before setup is complete so the client can prompt for a password change or 2FA.
export const GET = route(async (req) => {
  const session = await requireSession(req, { allowIncompleteSetup: true });
  return json(await getProfile(session));
});
