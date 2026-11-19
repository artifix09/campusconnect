import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { SessionState } from "@/lib/session";

export async function getProfile(state: SessionState) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: state.actor.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      registrationNo: true,
      emailNotifications: true,
      pushNotifications: true,
      createdAt: true,
      department: { select: { id: true, code: true, name: true } },
    },
  });

  const isStaff = state.actor.role !== "STUDENT";
  return {
    ...user,
    // Tells the client what the account still has to do before it can use the app.
    setup: {
      emailVerified: state.emailVerified,
      mustChangePassword: state.mustChangePassword,
      twoFactorEnabled: state.twoFactorEnabled,
      twoFactorRequired: isStaff && env.REQUIRE_ADMIN_2FA,
    },
  };
}

export const PreferencesInput = z
  .object({
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Send at least one preference." });

export async function updatePreferences(state: SessionState, input: z.infer<typeof PreferencesInput>) {
  return db.user.update({
    where: { id: state.actor.id },
    data: input,
    select: { emailNotifications: true, pushNotifications: true },
  });
}
