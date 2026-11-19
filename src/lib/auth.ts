import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { db } from "./db";
import { env, isProduction } from "./env";
import { newId } from "./ids";
import { logger, maskEmail } from "./logger";
import { emailLayout, sendEmail } from "./mailer";

const registrationPattern = env.REG_NO_PATTERN ? new RegExp(env.REG_NO_PATTERN) : null;

function assertUniversityEmail(email: string) {
  if (env.ALLOWED_EMAIL_DOMAINS.length === 0) return;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (!env.ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    throw new APIError("BAD_REQUEST", {
      message: `Please register with your university email (${env.ALLOWED_EMAIL_DOMAINS.map((d) => "@" + d).join(", ")}).`,
    });
  }
}

function sendSafely(label: string, email: Parameters<typeof sendEmail>[0]) {
  // Auth emails must not block or fail the request; failures are logged for follow-up.
  void sendEmail(email).catch((err) => logger.error({ err, to: maskEmail(email.to) }, `Could not send ${label} email`));
}

/**
 * Authentication (ADR-006): email + password with mandatory verification,
 * database sessions that can be revoked, TOTP two-factor for staff, and
 * rate-limited sign-in. Authorization is NOT done here; see src/domain/policy.ts.
 */
export const auth = betterAuth({
  appName: "CampusConnect",
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_URL],
  database: prismaAdapter(db, { provider: "postgresql" }),

  advanced: {
    cookiePrefix: "campusconnect",
    useSecureCookies: isProduction,
    database: { generateId: () => newId() },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 30 * 60,
    sendResetPassword: async ({ user, url }) => {
      const { html, text } = emailLayout({
        heading: "Reset your password",
        paragraphs: [
          `Hello ${user.name},`,
          "We received a request to reset your CampusConnect password. The link below works once and expires in 30 minutes.",
          "If you did not ask for this, you can ignore this email. Your password will not change.",
        ],
        action: { label: "Choose a new password", url },
      });
      sendSafely("password reset", { to: user.email, subject: "Reset your CampusConnect password", html, text });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 24 * 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      const { html, text } = emailLayout({
        heading: "Confirm your email",
        paragraphs: [
          `Welcome to CampusConnect, ${user.name}.`,
          "Confirm your university email address to start reporting and tracking campus issues. The link expires in 24 hours.",
        ],
        action: { label: "Confirm email", url },
      });
      sendSafely("verification", { to: user.email, subject: "Confirm your CampusConnect email", html, text });
    },
  },

  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "STUDENT" },
      departmentId: { type: "string", required: false, input: false },
      registrationNo: { type: "string", required: false, input: true },
      isActive: { type: "boolean", input: false, defaultValue: true },
      mustChangePassword: { type: "boolean", input: false, defaultValue: false },
    },
  },

  session: {
    expiresIn: 7 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },

  rateLimit: {
    // Shared across serverless instances through the rate_limit table; off for local development.
    // Limits are per IP address. A whole campus often shares one public IP, so they are
    // sized for a busy shared network while still making password guessing slow.
    enabled: env.APP_ENV === "production" || env.APP_ENV === "preview",
    storage: "database",
    window: 60,
    max: 300,
    customRules: {
      "/sign-in/email": { window: 60, max: 30 },
      "/sign-up/email": { window: 10 * 60, max: 20 },
      "/request-password-reset": { window: 10 * 60, max: 10 },
      "/forget-password": { window: 10 * 60, max: 10 },
      "/send-verification-email": { window: 10 * 60, max: 10 },
      "/two-factor/verify-totp": { window: 60, max: 10 },
      "/two-factor/verify-backup-code": { window: 60, max: 10 },
    },
  },

  databaseHooks: {
    user: {
      create: {
        // Runs for self-registration. Staff accounts are created by the Super Admin directly.
        before: async (user) => {
          const email = user.email.toLowerCase();
          assertUniversityEmail(email);
          const registrationNo = (user as { registrationNo?: string | null }).registrationNo?.trim().toUpperCase();
          if (!registrationNo) {
            throw new APIError("BAD_REQUEST", { message: "Please enter your registration number." });
          }
          if (registrationPattern && !registrationPattern.test(registrationNo)) {
            throw new APIError("BAD_REQUEST", { message: "That registration number does not look right." });
          }
          if (await db.user.count({ where: { registrationNo } })) {
            throw new APIError("BAD_REQUEST", { message: "This registration number is already registered." });
          }
          return { data: { ...user, email, registrationNo, role: "STUDENT", departmentId: null } };
        },
      },
    },
    session: {
      create: {
        // Deactivated accounts cannot start new sessions.
        before: async (session) => {
          const user = await db.user.findUnique({ where: { id: session.userId }, select: { isActive: true } });
          if (!user?.isActive) {
            throw new APIError("FORBIDDEN", { message: "This account has been deactivated. Contact the administration." });
          }
          return { data: session };
        },
      },
    },
  },

  hooks: {
    // A successful password change clears the "change your one-time password" requirement.
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/change-password" || ctx.context.returned instanceof APIError) return;
      const userId = ctx.context.newSession?.user.id ?? ctx.context.session?.user.id;
      if (!userId) return;
      await db.user.updateMany({ where: { id: userId, mustChangePassword: true }, data: { mustChangePassword: false } });
    }),
  },

  plugins: [twoFactor({ issuer: "CampusConnect" }), nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;

/** Same scrypt hashing Better Auth uses at sign-up; used for staff accounts and seeding. */
export { hashPassword } from "better-auth/crypto";
