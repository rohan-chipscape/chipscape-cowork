import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/api/login") ||
    // "Sign in with Google" IS the login flow for unauthenticated visitors,
    // so it must be reachable before a session cookie exists.
    pathname.startsWith("/api/auth/google/start") ||
    pathname.startsWith("/api/auth/google/callback") ||
    // Download links use an unguessable UUID as the access control (like a
    // Drive "anyone with the link" share) so they work from a system browser
    // or another device without a session cookie.
    pathname.startsWith("/api/files/download/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const expected = process.env.APP_ACCESS_PASSWORD;
  const cookie = req.cookies.get("cowork_auth")?.value;

  if (expected && cookie === expected) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
