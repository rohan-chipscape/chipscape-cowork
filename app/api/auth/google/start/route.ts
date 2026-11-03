import { connection } from "next/server";
import { getOAuthClient, GOOGLE_SCOPES } from "@/lib/google/client";

export async function GET(req: Request) {
  await connection(); // env-dependent redirect; never prerender this
  try {
    const { searchParams } = new URL(req.url);
    // "native"/"native_login": set by the iOS app (via ASWebAuthenticationSession)
    // so the callback hands back a custom-scheme redirect instead of HTML.
    // "login": this *is* the sign-in flow itself (no separate password), so the
    // callback also starts a session instead of just linking a Gmail/Drive account.
    const rawState = searchParams.get("state");
    const state = ["native", "native_login", "login"].includes(rawState ?? "")
      ? (rawState as string)
      : undefined;

    const client = getOAuthClient();
    const url = client.generateAuthUrl({
      access_type: "offline",
      // "consent" ensures a refresh_token even on re-auth; "select_account"
      // always shows Google's account picker so connecting a second/third
      // account doesn't silently reuse whichever one is already signed in.
      prompt: "select_account consent",
      scope: GOOGLE_SCOPES,
      ...(state ? { state } : {}),
    });
    return Response.redirect(url);
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : String(err),
      { status: 500 }
    );
  }
}
