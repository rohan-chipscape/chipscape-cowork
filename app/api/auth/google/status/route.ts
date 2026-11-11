import { connection } from "next/server";
import { getAccountTokens } from "@/lib/google/accountStore";
import { getSessionEmail, isAdminSession } from "@/lib/auth/session";

export async function GET() {
  await connection(); // reads a local file at request time; never prerender this
  const configured = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );
  const email = await getSessionEmail();
  const connected = configured && !!email && !!getAccountTokens(email)?.refresh_token;
  const isAdmin = await isAdminSession();
  return Response.json({ configured, connected, email: connected ? email : null, isAdmin });
}
