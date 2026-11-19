import "server-only";
import { auth } from "./auth";
import { db } from "./db";
import { env } from "./env";
import { ForbiddenError, UnauthorizedError } from "./errors";
import { currentContext } from "./request-context";
import type { Actor } from "@/domain/types";

/** Staff sessions are capped at 12 hours regardless of activity (docs/05 section 2). */
const STAFF_SESSION_MAX_MS = 12 * 60 * 60 * 1000;

export type SessionState = {
  actor: Actor;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  mustChangePassword: boolean;
};

/**
 * Resolves the signed-in user from the session cookie. The session is looked
 * up in the database on every call, so revoked sessions and deactivated
 * accounts stop working immediately.
 */
export async function getSessionState(headers: Headers): Promise<SessionState | null> {
  const result = await auth.api.getSession({ headers });
  if (!result) return null;

  const { user, session } = result;
  if (!user.isActive) return null;

  const role = user.role;
  let actor: Actor;
  if (role === "STUDENT") {
    actor = { id: user.id, role, name: user.name, email: user.email };
  } else if (role === "SUPER_ADMIN") {
    actor = { id: user.id, role, name: user.name, email: user.email };
  } else if (role === "DEPT_ADMIN" && user.departmentId) {
    actor = { id: user.id, role, departmentId: user.departmentId, name: user.name, email: user.email };
  } else {
    return null; // inconsistent account: refuse rather than guess a scope
  }

  if (actor.role !== "STUDENT" && Date.now() - new Date(session.createdAt).getTime() > STAFF_SESSION_MAX_MS) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  const ctx = currentContext();
  if (ctx) ctx.actorId = actor.id;

  return {
    actor,
    emailVerified: Boolean(user.emailVerified),
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

type RequireOptions = {
  /** Allow staff who still have to change their password or enrol in 2FA (used by /me). */
  allowIncompleteSetup?: boolean;
};

export async function requireSession(req: Request, options: RequireOptions = {}): Promise<SessionState> {
  const state = await getSessionState(req.headers);
  if (!state) throw new UnauthorizedError();

  if (!options.allowIncompleteSetup) {
    if (state.mustChangePassword) {
      throw new ForbiddenError("Please change your one-time password before continuing.", "password-change-required");
    }
    if (state.actor.role !== "STUDENT" && env.REQUIRE_ADMIN_2FA && !state.twoFactorEnabled) {
      throw new ForbiddenError("Please set up two-factor authentication before continuing.", "two-factor-required");
    }
  }
  return state;
}

export async function requireActor(req: Request, options?: RequireOptions): Promise<Actor> {
  return (await requireSession(req, options)).actor;
}
