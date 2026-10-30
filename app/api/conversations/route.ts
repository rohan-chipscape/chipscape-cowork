import { connection } from "next/server";
import { listConversations, saveConversation } from "@/lib/conversations/store";
import type { Conversation } from "@/lib/conversations/types";

export async function GET() {
  await connection();
  return Response.json({ conversations: listConversations() });
}

export async function POST(req: Request) {
  const { title } = (await req.json().catch(() => ({}))) as { title?: string };
  const now = new Date().toISOString();
  const conv: Conversation = {
    id: crypto.randomUUID(),
    title: title?.trim() || "New chat",
    createdAt: now,
    updatedAt: now,
    order: [],
    turns: [],
  };
  saveConversation(conv);
  return Response.json(conv);
}
