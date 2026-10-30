import { connection } from "next/server";
import { listConnectedAccounts, removeAccount } from "@/lib/google/accountStore";

export async function GET() {
  await connection();
  return Response.json({ accounts: listConnectedAccounts() });
}

export async function DELETE(req: Request) {
  const { email } = (await req.json()) as { email?: string };
  if (!email) {
    return Response.json({ error: "Missing email" }, { status: 400 });
  }
  removeAccount(email);
  return Response.json({ ok: true });
}
