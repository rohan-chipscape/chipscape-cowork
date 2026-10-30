import { connection } from "next/server";
import { getOAuthClient, GOOGLE_SCOPES } from "@/lib/google/client";

export async function GET() {
  await connection(); // env-dependent redirect; never prerender this
  try {
    const client = getOAuthClient();
    const url = client.generateAuthUrl({
      access_type: "offline",
      // "consent" ensures a refresh_token even on re-auth; "select_account"
      // always shows Google's account picker so connecting a second/third
      // account doesn't silently reuse whichever one is already signed in.
      prompt: "select_account consent",
      scope: GOOGLE_SCOPES,
    });
    return Response.redirect(url);
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : String(err),
      { status: 500 }
    );
  }
}
