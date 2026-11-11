import { connection } from "next/server";
import { listAllConversations } from "@/lib/conversations/store";
import { isAdminSession } from "@/lib/auth/session";

export async function GET() {
  await connection();
  if (!(await isAdminSession())) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }
  return Response.json({ conversations: listAllConversations() });
}
