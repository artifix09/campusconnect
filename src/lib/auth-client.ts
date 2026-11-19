"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, twoFactorClient } from "better-auth/client/plugins";
import type { auth } from "./auth";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
    twoFactorClient({
      onTwoFactorRedirect() {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- runs outside React, router unavailable
        window.location.href = "/two-factor";
      },
    }),
  ],
});

/** Clears everything this device cached for the user (shared lab PCs), then signs out. */
export async function signOutEverywhere() {
  try {
    await fetch("/api/v1/push-subscriptions", { method: "DELETE", credentials: "same-origin" });
  } catch {
    // offline: the session is still ended below
  }
  navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_USER_DATA" });
  try {
    const { clearOutbox } = await import("./offline-queue");
    await clearOutbox();
  } catch {
    // IndexedDB unavailable (private mode)
  }
  await authClient.signOut();
  // Full reload on purpose: drops every piece of the previous user's in-memory state.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/login";
}
