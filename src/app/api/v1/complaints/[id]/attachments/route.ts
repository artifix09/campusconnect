import { PayloadTooLargeError, ValidationError } from "@/lib/errors";
import { created, route, uuidParam } from "@/lib/http";
import { requireActor } from "@/lib/session";
import { MAX_UPLOAD_BYTES } from "@/modules/attachments/image";
import { uploadAttachment } from "@/modules/attachments/service";

/** One image per request, sent as multipart/form-data in the "file" field. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireActor(req);
  const complaintId = uuidParam(params.id, "Complaint");

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) throw new PayloadTooLargeError("Images must be 4 MB or smaller.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ValidationError("Send the image as multipart/form-data in a field named file.");
  }
  return created(await uploadAttachment(actor, complaintId, form.get("file")));
});
