import { submitResult } from "@/lib/whatsapp/relay";

// The companion app POSTs here once it has finished running a command we
// sent it via /poll.
export async function POST(req: Request) {
  const { email, password, commandId, result, error } = (await req.json()) as {
    email?: string;
    password?: string;
    commandId?: string;
    result?: unknown;
    error?: string;
  };
  const expected = process.env.APP_ACCESS_PASSWORD;

  if (!email || !expected || password !== expected || !commandId) {
    return Response.json({ error: "Not authorized" }, { status: 401 });
  }

  submitResult(commandId, result, error ?? null);
  return Response.json({ ok: true });
}
