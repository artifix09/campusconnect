import { route, uuidParam } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { attachmentUrl } from "@/modules/attachments/service";

/** Redirects to a 5-minute signed URL after checking access to the parent complaint. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireActor(req);
  const url = await attachmentUrl(actor, uuidParam(params.id, "Image"));
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } });
});
