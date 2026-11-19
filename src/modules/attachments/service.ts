import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";
import { storage, storageEnabled } from "@/lib/storage";
import { audit } from "@/modules/audit/service";
import { findForActor } from "@/modules/complaints/repository";
import { complaintScope } from "@/domain/policy";
import type { Actor } from "@/domain/types";
import { processImage } from "./image";

export const MAX_ATTACHMENTS_PER_COMPLAINT = 3;

export async function uploadAttachment(actor: Actor, complaintId: string, file: unknown) {
  if (!(file instanceof File) || file.size === 0) {
    throw new ValidationError("Attach one image in the 'file' field.");
  }

  if (!storageEnabled) throw new BusinessRuleError("Photo uploads are not set up on this server yet.");
  await findForActor(actor, complaintId, "attach");
  await enforceRateLimit("uploadImage", actor.id);

  const existing = await db.attachment.count({ where: { complaintId } });
  if (existing >= MAX_ATTACHMENTS_PER_COMPLAINT) {
    throw new BusinessRuleError(`A complaint can have at most ${MAX_ATTACHMENTS_PER_COMPLAINT} images.`);
  }

  const image = await processImage(Buffer.from(await file.arrayBuffer()));
  const storageKey = `complaints/${complaintId}/${randomUUID()}.webp`;
  await storage.put(storageKey, image.data, image.mimeType);

  try {
    return await db.$transaction(async (tx) => {
      const attachment = await tx.attachment.create({
        data: {
          complaintId,
          uploadedById: actor.id,
          storageKey,
          mimeType: image.mimeType,
          sizeBytes: image.data.byteLength,
          width: image.width,
          height: image.height,
        },
        select: { id: true, mimeType: true, sizeBytes: true, width: true, height: true, createdAt: true },
      });
      await tx.complaintEvent.create({
        data: { complaintId, actorId: actor.id, type: "ATTACHMENT_ADDED", metadata: { attachmentId: attachment.id } },
      });
      await tx.complaint.update({ where: { id: complaintId }, data: { updatedAt: new Date() } });
      return attachment;
    });
  } catch (error) {
    // Keep storage and database in step: no orphaned files.
    await storage.remove(storageKey).catch((err) => logger.warn({ err, storageKey }, "Could not remove orphaned upload"));
    throw error;
  }
}

/** Opens the image for streaming, after the same access check as the parent complaint. */
export async function openAttachment(actor: Actor, attachmentId: string) {
  const attachment = await db.attachment.findFirst({
    where: { id: attachmentId, complaint: complaintScope(actor) },
    select: { storageKey: true },
  });

  if (!attachment) {
    const exists = await db.attachment.count({ where: { id: attachmentId } });
    if (!exists) throw new NotFoundError("Image not found.");
    await audit.denied(actor, { action: "attachment.read", entityType: "Attachment", entityId: attachmentId });
    throw new ForbiddenError("You do not have access to this image.");
  }

  return storage.open(attachment.storageKey);
}
