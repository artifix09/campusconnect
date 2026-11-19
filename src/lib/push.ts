import "server-only";
import webpush from "web-push";
import { env } from "./env";

const enabled = Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (enabled) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url?: string; tag?: string };

export type PushResult = "sent" | "gone" | "disabled";

/**
 * Sends one encrypted Web Push message. Returns "gone" when the push service
 * says the subscription no longer exists, so the caller can delete it.
 */
export async function sendPush(target: PushTarget, payload: PushPayload): Promise<PushResult> {
  if (!enabled) return "disabled";
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      { TTL: 24 * 60 * 60, urgency: "normal" },
    );
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    throw error;
  }
}

export const pushEnabled = enabled;
