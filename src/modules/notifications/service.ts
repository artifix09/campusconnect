import "server-only";
import { z } from "zod";
import { db, type Tx } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { emailLayout, sendEmail } from "@/lib/mailer";
import { sendPush } from "@/lib/push";
import { runAfterResponse } from "@/lib/background";
import type { Actor } from "@/domain/types";

/**
 * Notifications follow the transactional outbox pattern (ADR-013): the
 * in-app notification and one delivery row per external channel are written
 * in the same transaction as the change that caused them. Deliveries are sent
 * after the response and retried by /api/cron/deliveries until they succeed
 * or run out of attempts.
 */

export type NotificationDraft = {
  userIds: string[];
  type: string;
  title: string;
  body: string;
  link?: string;
};

const MAX_ATTEMPTS = 5;
const BACKOFF_MINUTES = [1, 5, 15, 60, 240];
const LEASE_MS = 5 * 60 * 1000;

export async function queueNotifications(tx: Tx, draft: NotificationDraft): Promise<string[]> {
  const userIds = [...new Set(draft.userIds)];
  if (userIds.length === 0) return [];

  const recipients = await tx.user.findMany({
    where: { id: { in: userIds }, isActive: true },
    select: {
      id: true,
      emailNotifications: true,
      pushNotifications: true,
      _count: { select: { pushSubscriptions: true } },
    },
  });

  const deliveryIds: string[] = [];
  for (const user of recipients) {
    const channels: ("EMAIL" | "PUSH")[] = [];
    if (user.emailNotifications) channels.push("EMAIL");
    if (user.pushNotifications && user._count.pushSubscriptions > 0) channels.push("PUSH");

    const notification = await tx.notification.create({
      data: {
        userId: user.id,
        type: draft.type,
        title: draft.title,
        body: draft.body,
        link: draft.link,
        deliveries: { create: channels.map((channel) => ({ channel })) },
      },
      select: { deliveries: { select: { id: true } } },
    });
    deliveryIds.push(...notification.deliveries.map((d) => d.id));
  }
  return deliveryIds;
}

/** Call after the transaction that queued the deliveries has committed. */
export function dispatchAfterResponse(deliveryIds: string[]) {
  if (deliveryIds.length > 0) runAfterResponse("notification-deliveries", () => deliver(deliveryIds));
}

export async function processDueDeliveries(limit = 100): Promise<number> {
  const due = await db.notificationDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    select: { id: true },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  });
  await deliver(due.map((d) => d.id));
  return due.length;
}

async function deliver(ids: string[]) {
  for (const id of ids) {
    // Claim a short lease so the cron job and an `after()` callback never send the same message twice.
    const now = new Date();
    const claimed = await db.notificationDelivery.updateMany({
      where: { id, status: "PENDING", nextAttemptAt: { lte: now } },
      data: { nextAttemptAt: new Date(now.getTime() + LEASE_MS) },
    });
    if (claimed.count === 0) continue;

    const delivery = await db.notificationDelivery.findUnique({
      where: { id },
      include: {
        notification: {
          include: {
            user: { select: { email: true, name: true, pushSubscriptions: true } },
          },
        },
      },
    });
    if (!delivery) continue;

    const attempts = delivery.attempts + 1;
    try {
      const { notification } = delivery;
      const url = new URL(notification.link ?? "/", env.APP_URL).toString();

      if (delivery.channel === "EMAIL") {
        const { html, text } = emailLayout({
          heading: notification.title,
          paragraphs: [`Hello ${notification.user.name},`, notification.body],
          action: { label: "Open CampusConnect", url },
        });
        await sendEmail({ to: notification.user.email, subject: notification.title, html, text });
      } else {
        for (const sub of notification.user.pushSubscriptions) {
          const result = await sendPush(sub, {
            title: notification.title,
            body: notification.body,
            url: notification.link ?? "/",
            tag: notification.id,
          });
          if (result === "gone") await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        }
      }

      await db.notificationDelivery.update({
        where: { id },
        data: { status: "SENT", attempts, sentAt: new Date(), lastError: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const exhausted = attempts >= MAX_ATTEMPTS;
      const delayMinutes = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)] ?? 240;
      await db.notificationDelivery.update({
        where: { id },
        data: {
          attempts,
          status: exhausted ? "FAILED" : "PENDING",
          lastError: message.slice(0, 500),
          nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
        },
      });
      logger.warn({ deliveryId: id, channel: delivery.channel, attempts, exhausted }, "Notification delivery failed");
    }
  }
}

// ---------------------------------------------------------------------------
// Recipients
// ---------------------------------------------------------------------------

export async function departmentAdminIds(tx: Tx, departmentId: string): Promise<string[]> {
  const admins = await tx.user.findMany({
    where: { role: "DEPT_ADMIN", departmentId, isActive: true },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

export async function superAdminIds(tx: Tx): Promise<string[]> {
  const admins = await tx.user.findMany({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true } });
  return admins.map((a) => a.id);
}

// ---------------------------------------------------------------------------
// The signed-in user's own notifications
// ---------------------------------------------------------------------------

export const ListNotificationsQuery = z.object({
  unread: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.uuid().optional(),
});

export async function listNotifications(actor: Actor, query: z.infer<typeof ListNotificationsQuery>) {
  const rows = await db.notification.findMany({
    where: { userId: actor.id, ...(query.unread === "true" ? { readAt: null } : {}) },
    select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const unreadCount = await db.notification.count({ where: { userId: actor.id, readAt: null } });
  const hasMore = rows.length > query.limit;
  const data = hasMore ? rows.slice(0, query.limit) : rows;
  return { data, unreadCount, nextCursor: hasMore ? data.at(-1)?.id : null };
}

export const MarkReadInput = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.uuid()).min(1).max(200) }),
]);

export async function markNotificationsRead(actor: Actor, input: z.infer<typeof MarkReadInput>) {
  const result = await db.notification.updateMany({
    where: { userId: actor.id, readAt: null, ...("ids" in input ? { id: { in: input.ids } } : {}) },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}

// ---------------------------------------------------------------------------
// Push subscriptions (one per device)
// ---------------------------------------------------------------------------

export const PushSubscriptionInput = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export async function savePushSubscription(actor: Actor, input: z.infer<typeof PushSubscriptionInput>, userAgent?: string) {
  await db.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId: actor.id,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: userAgent?.slice(0, 300),
    },
    // A device that changes hands (shared lab PC) is re-assigned to whoever subscribed last.
    update: { userId: actor.id, p256dh: input.keys.p256dh, auth: input.keys.auth },
  });
}

export async function removePushSubscription(actor: Actor, endpoint?: string) {
  await db.pushSubscription.deleteMany({ where: { userId: actor.id, ...(endpoint ? { endpoint } : {}) } });
}
