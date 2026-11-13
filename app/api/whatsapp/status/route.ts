import { connection } from "next/server";
import { getSessionEmail } from "@/lib/auth/session";
import { getSessionStatus } from "@/lib/whatsapp/client";

export async function GET() {
  await connection();
  const email = await getSessionEmail();
  if (!email) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  return Response.json(getSessionStatus(email));
}
