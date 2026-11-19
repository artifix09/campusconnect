import { created, json, readJson, route } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { DepartmentInput, createDepartment, listDepartments } from "@/modules/org/service";

export const GET = route(async (req) => {
  const actor = await requireActor(req);
  return json({ data: await listDepartments(actor) });
});

export const POST = route(async (req) => {
  const actor = await requireActor(req);
  return created(await createDepartment(actor, await readJson(req, DepartmentInput)));
});
