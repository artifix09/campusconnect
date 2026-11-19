import "server-only";
import { z } from "zod";

const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const bool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? fallback : v === "true" || v === "1"));

const schema = z
  .object({
    APP_ENV: z.enum(["development", "preview", "production", "test"]).default("development"),
    APP_URL: z.url().default("http://localhost:3000"),

    DATABASE_URL: z.string().min(1),

    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    ALLOWED_EMAIL_DOMAINS: z
      .string()
      .default("")
      .transform((v) =>
        v
          .split(",")
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean),
      ),
    REG_NO_PATTERN: optional,
    REQUIRE_ADMIN_2FA: bool(true),

    S3_ENDPOINT: optional,
    S3_REGION: z.string().default("auto"),
    // Optional so a staging deployment can run before object storage exists; required in production.
    S3_BUCKET: optional,
    S3_ACCESS_KEY_ID: optional,
    S3_SECRET_ACCESS_KEY: optional,
    S3_FORCE_PATH_STYLE: bool(false),
    /** Vercel Blob (private store). Takes precedence over S3 when set. */
    BLOB_READ_WRITE_TOKEN: optional,

    UPSTASH_REDIS_REST_URL: optional,
    UPSTASH_REDIS_REST_TOKEN: optional,

    EMAIL_FROM: z.string().default("CampusConnect <no-reply@campusconnect.local>"),
    RESEND_API_KEY: optional,
    SMTP_HOST: optional,
    SMTP_PORT: z.coerce.number().int().default(1025),
    SMTP_USER: optional,
    SMTP_PASSWORD: optional,

    NEXT_PUBLIC_VAPID_PUBLIC_KEY: optional,
    VAPID_PRIVATE_KEY: optional,
    VAPID_SUBJECT: z.string().default("mailto:admin@campusconnect.local"),

    CRON_SECRET: z.string().min(16),
    HEALTH_SECRET: z.string().min(16),
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV !== "production") return;
    const required: (keyof typeof env)[] = [
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
      "VAPID_PRIVATE_KEY",
    ];
    for (const key of required) {
      if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required in production` });
    }
    if (!env.RESEND_API_KEY && !(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD)) {
      ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "Configure Resend or an authenticated SMTP server in production" });
    }
    if (!env.BLOB_READ_WRITE_TOKEN && !(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY)) {
      ctx.addIssue({ code: "custom", path: ["BLOB_READ_WRITE_TOKEN"], message: "Configure Vercel Blob or an S3 bucket in production" });
    }
    if (env.ALLOWED_EMAIL_DOMAINS.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["ALLOWED_EMAIL_DOMAINS"],
        message: "Set at least one university email domain in production",
      });
    }
  });

export type Env = z.infer<typeof schema>;

/** On Vercel, fall back to the project's production domain when APP_URL is not set. */
function source(): NodeJS.ProcessEnv {
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return {
    ...process.env,
    APP_URL: process.env.APP_URL || (vercelHost ? `https://${vercelHost}` : undefined),
    // The Vercel Marketplace names Upstash credentials KV_REST_API_*.
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
  };
}

function load(): Env {
  const parsed = schema.safeParse(source());
  if (parsed.success) return parsed.data;

  const problems = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");

  // `next build` imports route modules to analyse them. Secrets are not available
  // there, so fall back to placeholders instead of failing the build.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return schema.parse({
      ...source(),
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://build:build@localhost:5432/build",
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "build-time-placeholder-secret-0000000000",
      CRON_SECRET: process.env.CRON_SECRET || "build-time-placeholder",
      HEALTH_SECRET: process.env.HEALTH_SECRET || "build-time-placeholder",
      APP_ENV: "development",
    });
  }

  throw new Error(`Invalid environment configuration:\n${problems}`);
}

export const env = load();

export const isProduction = env.APP_ENV === "production";
