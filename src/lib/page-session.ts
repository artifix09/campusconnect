import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { env } from "./env";
import { ForbiddenError, NotFoundError } from "./errors";
import { getSessionState, type SessionState } from "./session";
import type { Role } from "@/domain/types";

/**
 * Session guard for pages. It decides navigation only: what a user may read
 * is still enforced by the services and the scoped data layer underneath.
 */
// One session lookup per request, shared by the layout and the page.
const currentSession = cache(async () => getSessionState(await headers()));

export async function requirePageSession(allowed?: Role[]): Promise<SessionState> {
  const state = await currentSession();
  if (!state) redirect("/login");

  if (state.mustChangePassword) redirect("/setup/password");
  if (state.actor.role !== "STUDENT" && env.REQUIRE_ADMIN_2FA && !state.twoFactorEnabled) {
    redirect("/setup/two-factor");
  }

  if (allowed && !allowed.includes(state.actor.role)) {
    redirect(state.actor.role === "STUDENT" ? "/student" : "/admin");
  }
  return state;
}

/** Runs a loader and turns "not yours" into a denied result and "missing" into a 404 page. */
export async function loadOrDeny<T>(loader: () => Promise<T>): Promise<{ denied: true } | { denied: false; data: T }> {
  try {
    return { denied: false, data: await loader() };
  } catch (error) {
    if (error instanceof ForbiddenError) return { denied: true };
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}
