import "server-only";
import { timingSafeEqual } from "node:crypto";
import { UnauthorizedError } from "./errors";

/** Constant-time check of a `Authorization: Bearer <secret>` header. */
export function assertBearer(req: Request, secret: string) {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new UnauthorizedError("Missing or invalid credentials.");
  }
}
