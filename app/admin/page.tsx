"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Markdown } from "@/app/components/Markdown";
import type { AdminConversationSummary, Conversation } from "@/lib/conversations/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminPage() {
  const [status, setStatus] = useState<"loading" | "forbidden" | "ok">("loading");
  const [conversations, setConversations] = useState<AdminConversationSummary[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetch("/api/admin/conversations")
      .then(async (res) => {
        if (res.status === 403) {
          setStatus("forbidden");
          return;
        }
        const data = await res.json();
        setConversations(data.conversations ?? []);
        setStatus("ok");
      })
      .catch(() => setStatus("forbidden"));
  }, []);

  async function openConversation(id: string) {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/conversations/${id}`);
      if (res.ok) setSelected(await res.json());
    } finally {
      setLoadingDetail(false);
    }
  }

  if (status === "loading") {
    return <div className="flex min-h-screen items-center justify-center bg-black text-neutral-400">Loading…</div>;
  }

  if (status === "forbidden") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black text-neutral-300">
        <p>You're not authorized to view this page.</p>
        <Link href="/" className="text-sm text-blue-400 hover:underline">
          Back to chat
        </Link>
      </div>
    );
  }

  const groups = new Map<string, AdminConversationSummary[]>();
  for (const c of conversations) {
    const key = c.ownerEmail;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  return (
    <div className="flex min-h-screen bg-black text-neutral-200">
      <div className="w-[320px] shrink-0 overflow-y-auto border-r border-white/10 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Team chat history</h1>
          <Link href="/" className="text-xs text-blue-400 hover:underline">
            Back
          </Link>
        </div>
        {[...groups.entries()].map(([email, convos]) => (
          <div key={email} className="mb-5">
            <p className="mb-1.5 truncate text-xs font-medium text-neutral-500">
              {convos[0].ownerName ? `${convos[0].ownerName} (${email})` : email}
            </p>
            <div className="flex flex-col gap-0.5">
              {convos.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  className={`flex flex-col rounded-lg px-2.5 py-2 text-left text-sm ${
                    selected?.id === c.id ? "bg-[#2f2f2f] text-neutral-100" : "text-neutral-300 hover:bg-white/5"
                  }`}
                >
                  <span className="truncate">{c.title}</span>
                  <span className="text-xs text-neutral-500">{formatDate(c.updatedAt)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {conversations.length === 0 && <p className="text-sm text-neutral-500">No chats yet.</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loadingDetail && <p className="text-neutral-500">Loading…</p>}
        {!loadingDetail && !selected && (
          <p className="text-neutral-500">Select a conversation on the left to read it.</p>
        )}
        {!loadingDetail && selected && (
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <h2 className="text-xl font-semibold text-neutral-100">{selected.title}</h2>
            {selected.turns.map((turn) => (
              <div key={turn.id} className="flex flex-col gap-2 border-b border-white/10 pb-6">
                <p className="whitespace-pre-wrap rounded-xl bg-[#173e76] px-4 py-2.5 text-sm text-[#f6fafe]">
                  {turn.question}
                </p>
                {turn.kind === "agent" && turn.error && (
                  <p className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">{turn.error}</p>
                )}
                {turn.finalText && <Markdown text={turn.finalText} />}
              </div>
            ))}
            {selected.turns.length === 0 && <p className="text-neutral-500">No messages in this chat.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
