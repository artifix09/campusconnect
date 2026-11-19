import "server-only";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  departmentAdminIds,
  dispatchAfterResponse,
  queueNotifications,
  superAdminIds,
} from "@/modules/notifications/service";
import { escalationThreshold } from "@/domain/sla";
import { OPEN_STATUSES } from "@/domain/types";

const BATCH = 200;

/**
 * Hourly SLA job (FX-06). Idempotent: `overdue_notified_at` and
 * `escalated_at` record what was already sent, so re-runs never double-notify.
 */
export async function runSlaCheck(now = new Date()) {
  const overdue = await db.complaint.findMany({
    where: { status: { in: [...OPEN_STATUSES] }, dueAt: { lt: now }, overdueNotifiedAt: null },
    select: { id: true, referenceNo: true, departmentId: true },
    take: BATCH,
  });

  const escalate = await db.complaint.findMany({
    where: { status: { in: [...OPEN_STATUSES] }, dueAt: { lt: escalationThreshold(now) }, escalatedAt: null },
    select: { id: true, referenceNo: true, department: { select: { name: true } } },
    take: BATCH,
  });

  const deliveries: string[] = [];

  for (const complaint of overdue) {
    const ids = await db.$transaction(async (tx) => {
      const claimed = await tx.complaint.updateMany({
        where: { id: complaint.id, overdueNotifiedAt: null },
        data: { overdueNotifiedAt: now },
      });
      if (!claimed.count) return [];
      return queueNotifications(tx, {
        userIds: await departmentAdminIds(tx, complaint.departmentId),
        type: "complaint.overdue",
        title: `Overdue: ${complaint.referenceNo}`,
        body: `Complaint ${complaint.referenceNo} has passed its due date.`,
        link: `/admin/complaints/${complaint.id}`,
      });
    });
    deliveries.push(...ids);
  }

  for (const complaint of escalate) {
    const ids = await db.$transaction(async (tx) => {
      const claimed = await tx.complaint.updateMany({
        where: { id: complaint.id, escalatedAt: null },
        data: { escalatedAt: now },
      });
      if (!claimed.count) return [];
      await tx.complaintEvent.create({
        data: { complaintId: complaint.id, type: "ESCALATED", metadata: { reason: "overdue-24h" } },
      });
      return queueNotifications(tx, {
        userIds: await superAdminIds(tx),
        type: "complaint.escalated",
        title: `Escalated: ${complaint.referenceNo}`,
        body: `Complaint ${complaint.referenceNo} (${complaint.department.name}) is more than 24 hours overdue.`,
        link: `/admin/complaints/${complaint.id}`,
      });
    });
    deliveries.push(...ids);
  }

  dispatchAfterResponse(deliveries);
  const summary = { overdueNotified: overdue.length, escalated: escalate.length };
  logger.info(summary, "SLA check finished");
  return summary;
}

/** Daily housekeeping and retention (docs/04 section 11). */
export async function runCleanup(now = new Date()) {
  const day = 24 * 60 * 60 * 1000;
  const [sessions, verifications, notifications, rateLimits] = await Promise.all([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.verification.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.notification.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 180 * day) } } }),
    db.rateLimit.deleteMany({ where: { lastRequest: { lt: BigInt(now.getTime() - day) } } }),
  ]);
  const summary = {
    sessions: sessions.count,
    verifications: verifications.count,
    notifications: notifications.count,
    rateLimits: rateLimits.count,
  };
  logger.info(summary, "Cleanup finished");
  return summary;
}
