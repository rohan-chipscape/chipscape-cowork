import { connection } from "next/server";
import { listConversations, saveConversation } from "@/lib/conversations/store";
import type { Conversation } from "@/lib/conversations/types";
import { getSessionEmail, getSessionName } from "@/lib/auth/session";

export async function GET() {
  await connection();
  const ownerEmail = await getSessionEmail();
  if (!ownerEmail) return Response.json({ conversations: [] });
  return Response.json({ conversations: listConversations(ownerEmail) });
}

export async function POST(req: Request) {
  const { title } = (await req.json().catch(() => ({}))) as { title?: string };
  const ownerEmail = await getSessionEmail();
  if (!ownerEmail) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  const now = new Date().toISOString();
  const conv: Conversation = {
    id: crypto.randomUUID(),
    title: title?.trim() || "New chat",
    createdAt: now,
    updatedAt: now,
    order: [],
    turns: [],
    ownerEmail,
    ownerName: (await getSessionName()) ?? undefined,
  };
  saveConversation(conv);
  return Response.json(conv);
}
