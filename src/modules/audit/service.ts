import "server-only";
import type { Prisma } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { logger } from "@/lib/logger";
import { currentContext } from "@/lib/request-context";
import type { Actor } from "@/domain/types";

type AuditEntry = {
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
};

function base(actor: Actor | null, entry: AuditEntry) {
  const ctx = currentContext();
  return {
    actorId: actor?.id,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadata: entry.metadata,
    ip: ctx?.ip,
    userAgent: ctx?.userAgent?.slice(0, 300),
  };
}

export const audit = {
  /** Records a successful sensitive action, inside the caller's transaction. */
  async allowed(tx: Tx, actor: Actor, entry: AuditEntry) {
    await tx.auditLog.create({ data: { ...base(actor, entry), outcome: "ALLOWED" } });
  },

  /**
   * Records a denied access attempt. Written outside any transaction so it
   * survives the error that follows it.
   */
  async denied(actor: Actor, entry: AuditEntry) {
    logger.warn({ action: entry.action, entityType: entry.entityType, entityId: entry.entityId }, "Access denied");
    try {
      await db.auditLog.create({ data: { ...base(actor, entry), outcome: "DENIED" } });
    } catch (error) {
      logger.error({ err: error }, "Could not write audit log entry");
    }
  },
};
