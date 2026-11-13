import { touchPresence, waitForCommand } from "@/lib/whatsapp/relay";

// Long-polled by the companion app running on the account owner's own
// computer — it holds this request open until there's a command to run, or
// returns null after its own timeout so the companion can poll again.
export async function POST(req: Request) {
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  const expected = process.env.APP_ACCESS_PASSWORD;

  if (!email || !expected || password !== expected) {
    return Response.json({ error: "Not authorized" }, { status: 401 });
  }

  touchPresence(email);
  const command = await waitForCommand(email);
  return Response.json({ command });
}
