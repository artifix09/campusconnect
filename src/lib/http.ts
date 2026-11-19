import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z, type ZodType } from "zod";
import { AppError, NotFoundError, RateLimitedError, ValidationError } from "./errors";
import { logger } from "./logger";
import { clientIp, currentContext, newRequestId, runWithContext } from "./request-context";

const PROBLEM_BASE = "https://campusconnect.app/problems/";
const NO_STORE = { "Cache-Control": "private, no-store" };

type Handler<P> = (req: NextRequest, ctx: { params: P }) => Promise<Response>;

/**
 * Wraps a route handler with request context, structured logging and a single
 * error-to-HTTP mapping. Every /api/v1 handler is exported through this.
 */
export function route<P extends Record<string, string> = Record<string, never>>(handler: Handler<P>) {
  return async (req: NextRequest, segment: { params: Promise<P> }) => {
    const requestId = req.headers.get("x-request-id") ?? newRequestId();
    const context = { requestId, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") ?? undefined };

    return runWithContext(context, async () => {
      const started = performance.now();
      let response: Response;
      try {
        response = await handler(req, { params: await segment.params });
      } catch (error) {
        response = problem(error, req);
      }
      response.headers.set("X-Request-Id", requestId);
      logger.info(
        {
          method: req.method,
          path: req.nextUrl.pathname,
          status: response.status,
          durationMs: Math.round(performance.now() - started),
        },
        "request",
      );
      return response;
    });
  };
}

export function json(data: unknown, init: ResponseInit = {}) {
  return NextResponse.json(data, { ...init, headers: { ...NO_STORE, ...init.headers } });
}

export function created(data: unknown, location?: string) {
  return json(data, { status: 201, headers: location ? { Location: location } : {} });
}

export function noContent() {
  return new Response(null, { status: 204, headers: NO_STORE });
}

function problem(error: unknown, req: NextRequest): Response {
  const requestId = currentContext()?.requestId;
  const instance = req.nextUrl.pathname;

  if (error instanceof AppError) {
    const headers: Record<string, string> = { "Content-Type": "application/problem+json", ...NO_STORE };
    if (error instanceof RateLimitedError) headers["Retry-After"] = String(error.retryAfterSeconds);
    if (error.status >= 500) logger.error({ err: error }, error.message);
    return new Response(
      JSON.stringify({
        type: PROBLEM_BASE + error.type,
        title: error.title,
        status: error.status,
        detail: error.message,
        instance,
        requestId,
        ...error.extra,
      }),
      { status: error.status, headers },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return problem(new AppError(409, "duplicate", "Conflict", "This record already exists."), req);
  }

  logger.error({ err: error }, "Unhandled error");
  return new Response(
    JSON.stringify({
      type: PROBLEM_BASE + "internal",
      title: "Something went wrong",
      status: 500,
      detail: "An unexpected error occurred. Please try again. If it keeps happening, share the request ID with support.",
      instance,
      requestId,
    }),
    { status: 500, headers: { "Content-Type": "application/problem+json", ...NO_STORE } },
  );
}

function toValidationError(error: z.ZodError): ValidationError {
  return new ValidationError(
    "Some fields are invalid.",
    error.issues.map((issue) => ({ field: issue.path.join(".") || "(root)", message: issue.message })),
  );
}

export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw toValidationError(result.error);
  return result.data;
}

export async function readJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError("The request body must be valid JSON.");
  }
  return parse(schema, body);
}

export function readQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  return parse(schema, Object.fromEntries(req.nextUrl.searchParams));
}

/** Route IDs are UUIDs; anything else cannot exist, so it is a plain 404. */
export function uuidParam(value: string | undefined, what = "Resource"): string {
  const result = z.uuid().safeParse(value);
  if (!result.success) throw new NotFoundError(`${what} not found.`);
  return result.data;
}

/** Parses an `If-Match: "3"` header into the expected version number. */
export function expectedVersion(req: NextRequest): number | undefined {
  const raw = req.headers.get("if-match")?.replace(/"/g, "").trim();
  if (!raw) return undefined;
  const version = Number(raw);
  if (!Number.isInteger(version) || version < 1) throw new ValidationError("If-Match must be a version number.");
  return version;
}
