/**
 * Browser-side helper for calling /api/v1. Errors come back as RFC 9457
 * problem documents; this turns them into an ApiError with a readable message.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly type?: string,
    readonly fieldErrors: { field: string; message: string }[] = [],
  ) {
    super(message);
  }
}

type Options = Omit<RequestInit, "body"> & { body?: unknown };

export async function api<T = unknown>(path: string, { body, headers, ...init }: Options = {}): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetch(path.startsWith("/") ? path : `/api/v1/${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { ...(body && !isForm ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const problem = (data ?? {}) as { detail?: string; title?: string; type?: string; errors?: { field: string; message: string }[] };
    const message =
      problem.errors?.[0]?.message ?? problem.detail ?? problem.title ?? "Something went wrong. Please try again.";
    throw new ApiError(response.status, message, problem.type?.split("/").pop(), problem.errors);
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return "You appear to be offline. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}
