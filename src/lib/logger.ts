import "server-only";
import pino from "pino";
import { currentContext } from "./request-context";

// Structured JSON logs. Secrets and personal content are redacted at the source.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: { service: "campusconnect" },
  redact: {
    paths: [
      "password",
      "*.password",
      "token",
      "*.token",
      "headers.cookie",
      "headers.authorization",
      "description",
      "*.description",
      "body",
      "*.body",
    ],
    censor: "[redacted]",
  },
  mixin() {
    const ctx = currentContext();
    return ctx ? { requestId: ctx.requestId, actorId: ctx.actorId } : {};
  },
});

export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "***";
  return `${name[0]}***@${domain}`;
}
