"use client";

import { useEffect, useRef, useState } from "react";
import { useDebateChat, type HistoryMessage } from "@/lib/useDebateChat";
import { useAgentChat } from "@/lib/useAgentChat";
import { useConversations } from "@/lib/useConversations";
import { ModelPanel } from "@/app/components/ModelPanel";
import { Markdown } from "@/app/components/Markdown";
import { CopyButton } from "@/app/components/CopyButton";
import { AgentTurnView } from "@/app/components/AgentTurnView";
import { Sidebar } from "@/app/components/Sidebar";
import { Composer, type Attachment } from "@/app/components/Composer";
import { ConnectedAccounts } from "@/app/components/ConnectedAccounts";
import {
  serializeTurns,
  deserializeTurns,
  toStoredDebateTurn,
  toStoredAgentTurn,
} from "@/lib/conversations/serialize";

type OrderEntry = { kind: "debate" | "agent"; id: string };

export default function Home() {
  const debate = useDebateChat();
  const agent = useAgentChat();
  const convos = useConversations();
  const [order, setOrder] = useState<OrderEntry[]>([]);
  const [input, setInput] = useState("");
  const [classifying, setClassifying] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const stickToBottom = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [googleStatus, setGoogleStatus] = useState<{
    configured: boolean;
    connected: boolean;
  } | null>(null);
  const [userName, setUserName] = useState("");
  // Shared conversation memory across BOTH debate and agent turns — without
  // this, every new agent-mode message starts from a blank slate and forgets
  // facts established in earlier turns (its own or debate mode's).
  const sharedMemory = useRef<HistoryMessage[]>([]);
  const memorizedTurnIds = useRef<Set<string>>(new Set());

  const isBusy = debate.isBusy || agent.isBusy || classifying;

  function rememberTurn(entry: OrderEntry) {
    if (memorizedTurnIds.current.has(entry.id)) return;
    const turn =
      entry.kind === "debate" ? debate.getTurn(entry.id) : agent.getTurn(entry.id);
    if (!turn?.done || !turn.finalText) return;
    memorizedTurnIds.current.add(entry.id);
    sharedMemory.current = [
      ...sharedMemory.current,
      { role: "user", content: turn.question },
      { role: "assistant", content: turn.finalText },
    ];

    // Fire-and-forget: separate from per-chat sharedMemory above, this looks
    // for durable facts worth keeping in EVERY future chat, not just this one.
    fetch("/api/memory/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: turn.question, answer: turn.finalText }),
    }).catch(() => {});
  }

  useEffect(() => {
    fetch("/api/auth/google/status")
      .then((r) => r.json())
      .then(setGoogleStatus)
      .catch(() => {});
    convos.refreshList();
    try {
      const stored = localStorage.getItem("cowork_user_name");
      // Server sets this (non-httpOnly) cookie right after "Sign in with
      // Google" so the sidebar shows the CEO's real name on first login,
      // before anything's been saved to localStorage yet.
      const fromCookie = document.cookie
        .split("; ")
        .find((c) => c.startsWith("cowork_user_name="))
        ?.split("=")[1];
      const name = stored || (fromCookie ? decodeURIComponent(fromCookie) : "");
      setUserName(name);
      if (name && !stored) localStorage.setItem("cowork_user_name", name);
    } catch {
      // localStorage unavailable — falls back to "Guest" in the sidebar
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep following the bottom while a response streams in, like ChatGPT —
  // but stop as soon as the user scrolls up to read earlier messages, and
  // resume once they scroll back down themselves or send a new message.
  useEffect(() => {
    if (stickToBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [order, debate.turns, agent.turns]);

  function handleMainScroll() {
    const el = mainRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distanceFromBottom < 120;
  }

  function startNewChat() {
    convos.setActiveId(null);
    setOrder([]);
    debate.reset();
    agent.reset();
    setInput("");
    setAttachment(null);
    sharedMemory.current = [];
    memorizedTurnIds.current = new Set();
    stickToBottom.current = true;
  }

  async function openChat(id: string) {
    const conv = await convos.load(id);
    if (!conv) return;
    stickToBottom.current = true;
    const { order: loadedOrder, debate: debateTurns, agent: agentTurns } =
      deserializeTurns(conv.turns);
    debate.hydrate(debateTurns);
    agent.hydrate(agentTurns);
    setOrder(loadedOrder);

    sharedMemory.current = conv.turns.flatMap((t) =>
      t.finalText
        ? [
            { role: "user" as const, content: t.question },
            { role: "assistant" as const, content: t.finalText },
          ]
        : []
    );
    memorizedTurnIds.current = new Set(conv.turns.map((t) => t.id));
  }

  async function deleteChat(id: string) {
    await convos.remove(id);
    if (convos.activeId === id) startNewChat();
  }

  async function persist(nextOrder: OrderEntry[]) {
    // Title should be set exactly once, from the conversation's actual first
    // save — not whenever there happens to be only one turn (which is also
    // true on every approval round-trip of a multi-step agent turn).
    const isNewConversation = !convos.activeId;
    let id = convos.activeId;
    if (!id) {
      id = await convos.createNew();
    }

    // debate.turns/agent.turns (from the hooks' React state) can still be one
    // render behind right after `ask` resolves, so every earlier turn is
    // safe to read from them, but the turn that just finished has to come
    // from the hook's ref-backed getTurn() instead.
    const allButLatest = nextOrder.slice(0, -1);
    const latestEntry = nextOrder[nextOrder.length - 1];
    const turns = serializeTurns(allButLatest, debate.turns, agent.turns);

    if (latestEntry) {
      const stored =
        latestEntry.kind === "debate"
          ? toStoredDebateTurn(debate.getTurn(latestEntry.id)!)
          : toStoredAgentTurn(agent.getTurn(latestEntry.id)!);
      turns.push(stored);
    }

    await convos.save(id, {
      order: nextOrder,
      turns,
      ...(isNewConversation && turns[0] ? { title: turns[0].question.slice(0, 60) } : {}),
    });
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/files/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed");
      } else {
        setAttachment({ name: data.name, text: data.text });
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if ((!q && !attachment) || isBusy) return;
    setInput("");
    stickToBottom.current = true;

    const displayQuestion = attachment
      ? `📎 ${attachment.name}${q ? `\n\n${q}` : ""}`
      : q;
    const modelQuestion = attachment
      ? `Attached file: ${attachment.name}\n"""\n${attachment.text}\n"""\n\n${
          q || "Summarize this file and call out anything notable."
        }`
      : q;
    setAttachment(null);

    setClassifying(true);
    let mode: "agent" | "debate" = "debate";
    try {
      const res = await fetch("/api/agent/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: modelQuestion }),
      });
      const data = await res.json();
      if (data.mode === "agent") mode = "agent";
    } catch {
      // classification failure falls back to the safe debate mode
    }
    setClassifying(false);

    let newOrder: OrderEntry[] = order;
    const addToOrder = (kind: OrderEntry["kind"]) => (id: string) => {
      newOrder = [...order, { kind, id }];
      setOrder(newOrder);
    };

    const priorHistory = sharedMemory.current;
    if (mode === "agent") {
      await agent.ask(modelQuestion, addToOrder("agent"), displayQuestion, priorHistory);
    } else {
      await debate.ask(modelQuestion, addToOrder("debate"), displayQuestion, priorHistory);
    }
    rememberTurn(newOrder[newOrder.length - 1]);

    await persist(newOrder);
  }

  async function handleResolvePending(
    turnId: string,
    decisions: Record<string, boolean>
  ) {
    await agent.resolvePending(turnId, decisions);
    rememberTurn({ kind: "agent", id: turnId });
    await persist(order);
  }

  return (
    <div className="flex h-screen bg-[#000000] text-neutral-100">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        conversations={convos.conversations}
        activeId={convos.activeId}
        onNewChat={startNewChat}
        onSelect={openChat}
        onDelete={deleteChat}
        userName={userName}
      />

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end gap-2 px-4 py-3 sm:px-6">
          <ConnectedAccounts configured={!!googleStatus?.configured} />
        </header>

        {order.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 pb-32 sm:px-6">
            <h1 className="mb-6 text-[28px] font-normal text-neutral-100">
              What&apos;s on your mind today?
            </h1>
            <div className="w-full max-w-3xl">
              <Composer
                input={input}
                onInputChange={setInput}
                onSubmit={handleSubmit}
                isBusy={isBusy}
                attachment={attachment}
                onRemoveAttachment={() => setAttachment(null)}
                uploading={uploading}
                uploadError={uploadError}
                fileInputRef={fileInputRef}
                onFileSelected={handleFileSelected}
              />
            </div>
          </div>
        ) : (
        <>
        <main
          ref={mainRef}
          onScroll={handleMainScroll}
          className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {order.map((entry) => {
              if (entry.kind === "debate") {
                const t = debate.turns.find((x) => x.id === entry.id);
                if (!t) return null;
                return (
                  <div key={t.id} className="flex flex-col gap-3">
                    <div className="flex justify-end">
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-[#173e76] px-5 py-2.5 text-sm text-[#f6fafe]">
                        {t.question}
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <ModelPanel panel={t.panel} synthesizing={t.synthesizing} />
                      {t.synthesisError ? (
                        <div className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                          {t.synthesisError}
                        </div>
                      ) : (
                        (t.finalText || t.synthesizing) && (
                          <div className="flex flex-col gap-1.5">
                            {t.judgeLabel && (
                              <span className="px-1 text-xs text-neutral-500">
                                Synthesized by {t.judgeLabel}
                              </span>
                            )}
                            <div className="px-1 text-neutral-100">
                              {t.finalText ? (
                                <Markdown text={t.finalText} />
                              ) : (
                                <span className="text-sm text-neutral-500">
                                  Thinking…
                                </span>
                              )}
                            </div>
                            {t.finalText && !t.synthesizing && (
                              <div className="px-1">
                                <CopyButton text={t.finalText} />
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              }

              const t = agent.turns.find((x) => x.id === entry.id);
              if (!t) return null;
              return (
                <div key={t.id} className="flex flex-col gap-3">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-[#173e76] px-5 py-2.5 text-sm text-[#f6fafe]">
                      {t.question}
                    </div>
                  </div>
                  <span className="px-1 text-xs text-neutral-500">
                    Agent mode
                  </span>
                  <AgentTurnView turn={t} onResolve={handleResolvePending} />
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </main>

        <div className="bg-[#000000] px-4 pb-6 pt-2 sm:px-6">
          <Composer
            input={input}
            onInputChange={setInput}
            onSubmit={handleSubmit}
            isBusy={isBusy}
            attachment={attachment}
            onRemoveAttachment={() => setAttachment(null)}
            uploading={uploading}
            uploadError={uploadError}
            fileInputRef={fileInputRef}
            onFileSelected={handleFileSelected}
          />
        </div>
        </>
        )}
      </div>
    </div>
  );
}
