import { created, json, readJson, readQuery, route } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { CreateAdminInput, ListUsersQuery, createAdmin, listUsers } from "@/modules/org/service";

export const GET = route(async (req) => {
  const actor = await requireActor(req);
  return json(await listUsers(actor, readQuery(req, ListUsersQuery)));
});

/** Creates a department admin or super admin with a one-time password sent by email. */
export const POST = route(async (req) => {
  const actor = await requireActor(req);
  return created(await createAdmin(actor, await readJson(req, CreateAdminInput)));
});
