import { getSessionEmail } from "@/lib/auth/session";
import { startSession } from "@/lib/whatsapp/client";

export async function POST() {
  const email = await getSessionEmail();
  if (!email) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  // Fire-and-forget: this takes a few seconds (launching a real browser) —
  // the client polls /api/whatsapp/status for the QR code once it's ready.
  void startSession(email);
  return Response.json({ ok: true });
}
