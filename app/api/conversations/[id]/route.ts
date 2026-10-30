import { connection } from "next/server";
import {
  deleteConversation,
  getConversation,
  saveConversation,
} from "@/lib/conversations/store";
import type { Conversation } from "@/lib/conversations/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  await connection();
  const { id } = await params;
  const conv = getConversation(id);
  if (!conv) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(conv);
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const body = (await req.json()) as Partial<Conversation>;
  const existing = getConversation(id);
  const now = new Date().toISOString();

  const conv: Conversation = {
    id,
    title: body.title ?? existing?.title ?? "New chat",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    order: body.order ?? existing?.order ?? [],
    turns: body.turns ?? existing?.turns ?? [],
  };
  saveConversation(conv);
  return Response.json(conv);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  deleteConversation(id);
  return Response.json({ ok: true });
}
