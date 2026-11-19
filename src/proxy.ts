import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic checks only (ADR-007). This never decides access to data: every
 * route handler re-validates the session against the database and the data
 * layer scopes every query. Here we only add a request ID and send visitors
 * without a session cookie to the login page.
 */
export function proxy(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);

  const { pathname } = request.nextUrl;
  const isAppPage = pathname.startsWith("/student") || pathname.startsWith("/admin");
  if (isAppPage && !getSessionCookie(request, { cookiePrefix: "campusconnect" })) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("X-Request-Id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest).*)"],
};
