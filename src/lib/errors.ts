/**
 * Typed application errors. Services throw these; the HTTP layer maps them to
 * RFC 9457 problem responses in exactly one place (src/lib/http.ts).
 * This file has no framework imports so the domain layer can use it.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly type: string,
    readonly title: string,
    message: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Some fields are invalid.", errors?: { field: string; message: string }[]) {
    super(400, "validation-error", "Invalid request", message, errors ? { errors } : undefined);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Please sign in to continue.") {
    super(401, "unauthorized", "Not signed in", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource.", type = "forbidden") {
    super(403, type, "Access denied", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super(404, "not-found", "Not found", message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, type = "conflict") {
    super(409, type, "Conflict", message);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message: string) {
    super(413, "payload-too-large", "File too large", message);
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message: string) {
    super(415, "unsupported-media-type", "Unsupported file type", message);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, type = "business-rule") {
    super(422, type, "Request cannot be completed", message);
  }
}

export class RateLimitedError extends AppError {
  constructor(readonly retryAfterSeconds: number) {
    super(429, "rate-limited", "Too many requests", "You are doing that too often. Please try again later.");
  }
}
