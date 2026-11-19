import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";

export type RequestContext = {
  requestId: string;
  ip?: string;
  userAgent?: string;
  actorId?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentContext(): RequestContext | undefined {
  return storage.getStore();
}

export function newRequestId(): string {
  return `req_${randomBytes(8).toString("hex")}`;
}

export function clientIp(headers: Headers): string | undefined {
  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip") || undefined;
}
