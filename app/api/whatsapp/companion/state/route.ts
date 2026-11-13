import { reportState } from "@/lib/whatsapp/relay";

// The companion app POSTs its WhatsApp connection state here (qr/ready/
// auth_failure/disconnected) so the web UI's existing /api/whatsapp/status
// polling keeps working unchanged.
export async function POST(req: Request) {
  const { email, password, state, qrDataUrl, error } = (await req.json()) as {
    email?: string;
    password?: string;
    state?: "idle" | "qr" | "ready" | "auth_failure" | "disconnected";
    qrDataUrl?: string | null;
    error?: string | null;
  };
  const expected = process.env.APP_ACCESS_PASSWORD;

  if (!email || !expected || password !== expected || !state) {
    return Response.json({ error: "Not authorized" }, { status: 401 });
  }

  reportState(email, state, qrDataUrl ?? null, error ?? null);
  return Response.json({ ok: true });
}
