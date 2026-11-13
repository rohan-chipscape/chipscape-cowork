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
    // The WhatsApp companion app running on the account owner's own computer
    // isn't a browser with our session cookie — it authenticates itself with
    // an email+password body on every call instead (checked inside each of
    // these route handlers, same credential as /api/login).
    pathname.startsWith("/api/whatsapp/companion/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon.png" ||
    pathname === "/manifest.json"
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
