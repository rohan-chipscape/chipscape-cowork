"use client";

import { useCallback, useRef, useState } from "react";

export type ModelStatus = "thinking" | "done" | "error";

export type ModelPanelEntry = {
  id: string;
  label: string;
  status: ModelStatus;
  text: string;
  latencyMs?: number;
  error?: string;
};

export type Turn = {
  id: string;
  question: string;
  panel: ModelPanelEntry[];
  synthesizing: boolean;
  finalText: string;
  synthesisError?: string;
  judgeLabel?: string;
  done: boolean;
};

type SSEEvent = { event: string; data: any };

function parseSSEChunk(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const blocks = chunk.split("\n\n").filter(Boolean);
  for (const block of blocks) {
    let event = "message";
    let dataLine = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) dataLine += line.slice(5).trim();
    }
    if (dataLine) {
      try {
        events.push({ event, data: JSON.parse(dataLine) });
      } catch {
        // ignore malformed chunk
      }
    }
  }
  return events;
}

export type HistoryMessage = { role: "user" | "assistant"; content: string };

export function useDebateChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  // Mirrors each turn's latest state synchronously, so callers can read the
  // final turn right after `ask` resolves without racing React's batching.
  const latestTurns = useRef<Record<string, Turn>>({});
  const [isBusy, setIsBusy] = useState(false);

  const ask = useCallback(async (
    question: string,
    onTurnCreated?: (id: string) => void,
    displayQuestion?: string,
    priorHistory: HistoryMessage[] = []
  ) => {
    const turnId = crypto.randomUUID();
    const requestHistory: HistoryMessage[] = [
      ...priorHistory,
      { role: "user", content: question },
    ];

    setIsBusy(true);
    onTurnCreated?.(turnId);
    const initial: Turn = {
      id: turnId,
      question: displayQuestion ?? question,
      panel: [],
      synthesizing: false,
      finalText: "",
      done: false,
    };
    latestTurns.current[turnId] = initial;
    setTurns((prev) => [...prev, initial]);

    const update = (fn: (t: Turn) => Turn) => {
      const next = fn(latestTurns.current[turnId]);
      latestTurns.current[turnId] = next;
      setTurns((prev) => prev.map((t) => (t.id === turnId ? next : t)));
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: requestHistory }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        const events = parseSSEChunk(parts.join("\n\n"));

        for (const { event, data } of events) {
          if (event === "panel") {
            update((t) => ({
              ...t,
              panel: data.models.map((m: any) => ({
                id: m.id,
                label: m.label,
                status: "thinking" as ModelStatus,
                text: "",
              })),
            }));
          } else if (event === "model_done") {
            update((t) => ({
              ...t,
              panel: t.panel.map((p) =>
                p.id === data.provider
                  ? {
                      ...p,
                      status: data.error ? "error" : "done",
                      text: data.text,
                      latencyMs: data.latencyMs,
                      error: data.error,
                    }
                  : p
              ),
            }));
          } else if (event === "synthesis_start") {
            update((t) => ({ ...t, synthesizing: true }));
          } else if (event === "synthesis_judge") {
            update((t) => ({ ...t, judgeLabel: data.label }));
          } else if (event === "synthesis_chunk") {
            update((t) => ({
              ...t,
              finalText: t.finalText + data.text,
            }));
          } else if (event === "synthesis_error") {
            update((t) => ({
              ...t,
              synthesizing: false,
              synthesisError: data.message,
            }));
          } else if (event === "done") {
            update((t) => ({ ...t, synthesizing: false, done: true }));
          }
        }
      }

    } catch (err) {
      update((t) => ({
        ...t,
        synthesizing: false,
        done: true,
        synthesisError: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setIsBusy(false);
    }

    return turnId;
  }, []);

  const hydrate = useCallback((loaded: Turn[]) => {
    setTurns(loaded);
    latestTurns.current = Object.fromEntries(loaded.map((t) => [t.id, t]));
  }, []);

  const reset = useCallback(() => {
    setTurns([]);
    latestTurns.current = {};
  }, []);

  const getTurn = useCallback((id: string) => latestTurns.current[id], []);

  return { turns, ask, isBusy, hydrate, reset, getTurn };
}
