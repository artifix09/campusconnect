import { route, uuidParam } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { openAttachment } from "@/modules/attachments/service";

/**
 * Streams a complaint photo after checking access to its complaint. The
 * storage location is never exposed, and the browser may only cache it privately.
 */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireActor(req);
  const file = await openAttachment(actor, uuidParam(params.id, "Image"));
  return new Response(file.body, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
