"use client";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushSupport = "unsupported" | "default" | "granted" | "denied";

export function pushSupport(): PushSupport {
  if (!VAPID || typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

function toKey(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Requests permission, subscribes this device and registers it with the server. */
export async function enablePush(): Promise<boolean> {
  if (pushSupport() === "unsupported") return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID) }));

  const json = subscription.toJSON();
  const response = await fetch("/api/v1/push-subscriptions", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  return response.ok;
}

export async function disablePush(): Promise<void> {
  const registration = await navigator.serviceWorker?.ready;
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await fetch("/api/v1/push-subscriptions", {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  await subscription.unsubscribe();
}
