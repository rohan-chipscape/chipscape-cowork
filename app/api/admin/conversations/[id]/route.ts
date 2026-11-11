import { connection } from "next/server";
import { getConversationAnyOwner } from "@/lib/conversations/store";
import { isAdminSession } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  await connection();
  if (!(await isAdminSession())) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }
  const { id } = await params;
  const conv = getConversationAnyOwner(id);
  if (!conv) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(conv);
}
