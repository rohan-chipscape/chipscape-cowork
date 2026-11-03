import { connection } from "next/server";
import { getAccountTokens, removeAccount } from "@/lib/google/accountStore";
import { getSessionEmail } from "@/lib/auth/session";

// Scoped to this session's own account only — never the full global pool of
// every Google account anyone has ever connected (see lib/agent/tools.ts).
export async function GET() {
  await connection();
  const email = await getSessionEmail();
  const connected = !!email && !!getAccountTokens(email)?.refresh_token;
  return Response.json({ accounts: connected ? [email] : [] });
}

export async function DELETE() {
  const email = await getSessionEmail();
  if (!email) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  removeAccount(email);
  return Response.json({ ok: true });
}
