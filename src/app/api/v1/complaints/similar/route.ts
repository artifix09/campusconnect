import { json, readQuery, route } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { findSimilar } from "@/modules/complaints/service";
import { SimilarQuery } from "@/modules/complaints/schemas";

export const GET = route(async (req) => {
  const actor = await requireActor(req);
  return json({ data: await findSimilar(actor, readQuery(req, SimilarQuery)) });
});
