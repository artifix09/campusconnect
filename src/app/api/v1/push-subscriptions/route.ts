import { z } from "zod";
import { noContent, readJson, route } from "@/lib/http";
import { requireActor } from "@/lib/session";
import {
  PushSubscriptionInput,
  removePushSubscription,
  savePushSubscription,
} from "@/modules/notifications/service";

export const POST = route(async (req) => {
  const actor = await requireActor(req);
  const input = await readJson(req, PushSubscriptionInput);
  await savePushSubscription(actor, input, req.headers.get("user-agent") ?? undefined);
  return noContent();
});

/** Removes this device's subscription, or all of the user's subscriptions when no endpoint is sent (logout). */
export const DELETE = route(async (req) => {
  const actor = await requireActor(req);
  const hasBody = Number(req.headers.get("content-length") ?? 0) > 0;
  const input = hasBody ? await readJson(req, z.object({ endpoint: z.url().optional() })) : {};
  await removePushSubscription(actor, input.endpoint);
  return noContent();
});
