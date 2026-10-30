"use client";

import { useCallback, useState } from "react";
import type { Conversation, ConversationSummary } from "@/lib/conversations/types";

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    const res = await fetch("/api/conversations");
    const data = await res.json();
    setConversations(data.conversations ?? []);
  }, []);

  const createNew = useCallback(async (): Promise<string> => {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const conv: Conversation = await res.json();
    setActiveId(conv.id);
    refreshList();
    return conv.id;
  }, [refreshList]);

  const load = useCallback(async (id: string): Promise<Conversation | null> => {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) return null;
    const conv: Conversation = await res.json();
    setActiveId(id);
    return conv;
  }, []);

  const save = useCallback(
    async (id: string, data: Partial<Conversation>) => {
      await fetch(`/api/conversations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      refreshList();
    },
    [refreshList]
  );

  const remove = useCallback(
    async (id: string) => {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (activeId === id) setActiveId(null);
      refreshList();
    },
    [activeId, refreshList]
  );

  return {
    conversations,
    activeId,
    setActiveId,
    refreshList,
    createNew,
    load,
    save,
    remove,
  };
}
