import { connection } from "next/server";
import {
  conversationExists,
  deleteConversation,
  getConversation,
  saveConversation,
} from "@/lib/conversations/store";
import type { Conversation } from "@/lib/conversations/types";
import { getSessionEmail, getSessionName } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  await connection();
  const { id } = await params;
  const ownerEmail = await getSessionEmail();
  const conv = ownerEmail ? getConversation(id, ownerEmail) : null;
  if (!conv) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(conv);
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const body = (await req.json()) as Partial<Conversation>;
  const ownerEmail = await getSessionEmail();
  if (!ownerEmail) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const existing = getConversation(id, ownerEmail);
  // The id exists but didn't come back owned by this session — it belongs
  // to a different account. Refuse rather than silently reassigning it.
  if (!existing && conversationExists(id)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const conv: Conversation = {
    id,
    title: body.title ?? existing?.title ?? "New chat",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    order: body.order ?? existing?.order ?? [],
    turns: body.turns ?? existing?.turns ?? [],
    ownerEmail,
    ownerName: (await getSessionName()) ?? existing?.ownerName,
  };
  saveConversation(conv);
  return Response.json(conv);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const ownerEmail = await getSessionEmail();
  if (!ownerEmail) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  deleteConversation(id, ownerEmail);
  return Response.json({ ok: true });
}
