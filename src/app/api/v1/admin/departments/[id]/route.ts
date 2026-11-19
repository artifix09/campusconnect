import { json, readJson, route, uuidParam } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { DepartmentUpdate, updateDepartment } from "@/modules/org/service";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireActor(req);
  return json(await updateDepartment(actor, uuidParam(params.id, "Department"), await readJson(req, DepartmentUpdate)));
});
