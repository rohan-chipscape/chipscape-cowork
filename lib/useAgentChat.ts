"use client";

import { useCallback, useRef, useState } from "react";
import type { AgentMessage, AgentToolCall } from "@/lib/agent/types";
import { SIDE_EFFECT_TOOLS } from "@/lib/agent/types";
import type { HistoryMessage } from "@/lib/useDebateChat";

export type AgentStepLog = {
  id: string;
  name: string;
  args: string;
  status: "pending" | "approved" | "denied" | "done" | "error";
  result?: string;
};

export type AgentTurn = {
  id: string;
  question: string;
  steps: AgentStepLog[];
  pendingCalls: AgentToolCall[] | null;
  finalText: string;
  error?: string;
  done: boolean;
};

const MAX_STEPS = 8;

export function useAgentChat() {
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const transcripts = useRef<Record<string, AgentMessage[]>>({});
  // Mirrors each turn's latest state synchronously, so callers can read the
  // final turn right after `ask`/`resolvePending` resolves without racing
  // React's batching.
  const latestTurns = useRef<Record<string, AgentTurn>>({});
  const [isBusy, setIsBusy] = useState(false);

  const update = (turnId: string, fn: (t: AgentTurn) => AgentTurn) => {
    const next = fn(latestTurns.current[turnId]);
    latestTurns.current[turnId] = next;
    setTurns((prev) => prev.map((t) => (t.id === turnId ? next : t)));
  };

  const runLoop = useCallback(async (turnId: string, depth = 0) => {
    if (depth >= MAX_STEPS) {
      update(turnId, (t) => ({
        ...t,
        done: true,
        error: "Stopped after too many steps — ask a more specific follow-up.",
      }));
      setIsBusy(false);
      return;
    }

    const history = transcripts.current[turnId];
    const res = await fetch("/api/agent/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: history }),
    });
    const data = await res.json();

    if (data.type === "final") {
      transcripts.current[turnId] = [
        ...history,
        { role: "assistant", content: data.text },
      ];
      update(turnId, (t) => ({ ...t, finalText: data.text, done: true }));
      setIsBusy(false);
      return;
    }

    if (data.type === "tool_calls") {
      const calls: AgentToolCall[] = data.calls;
      transcripts.current[turnId] = [
        ...history,
        { role: "assistant", content: null, tool_calls: calls },
      ];
      update(turnId, (t) => ({
        ...t,
        steps: [
          ...t.steps,
          ...calls.map((c) => ({
            id: c.id,
            name: c.name,
            args: c.arguments,
            status: "pending" as const,
          })),
        ],
      }));

      const autoCalls = calls.filter((c) => !SIDE_EFFECT_TOOLS.has(c.name));
      const approvalCalls = calls.filter((c) => SIDE_EFFECT_TOOLS.has(c.name));

      if (autoCalls.length > 0) {
        const decisions = Object.fromEntries(autoCalls.map((c) => [c.id, true]));
        const execRes = await fetch("/api/agent/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calls: autoCalls, decisions }),
        });
        const execData = await execRes.json();

        const toolMessages: AgentMessage[] = execData.results.map(
          (r: { id: string; result: unknown }) => ({
            role: "tool" as const,
            tool_call_id: r.id,
            content: JSON.stringify(r.result),
          })
        );
        transcripts.current[turnId] = [
          ...transcripts.current[turnId],
          ...toolMessages,
        ];

        update(turnId, (t) => ({
          ...t,
          steps: t.steps.map((s) => {
            const match = execData.results.find((r: { id: string }) => r.id === s.id);
            if (!match) return s;
            return { ...s, status: "done", result: JSON.stringify(match.result).slice(0, 2000) };
          }),
        }));
      }

      if (approvalCalls.length > 0) {
        update(turnId, (t) => ({ ...t, pendingCalls: approvalCalls }));
        setIsBusy(false);
        return;
      }

      await runLoop(turnId, depth + 1);
      return;
    }

    update(turnId, (t) => ({
      ...t,
      done: true,
      error: data.message || "The agent failed to respond.",
    }));
    setIsBusy(false);
  }, []);

  const ask = useCallback(
    async (
      question: string,
      onTurnCreated?: (id: string) => void,
      displayQuestion?: string,
      priorHistory: HistoryMessage[] = []
    ) => {
      const turnId = crypto.randomUUID();
      transcripts.current[turnId] = [
        ...priorHistory,
        { role: "user", content: question },
      ];

      setIsBusy(true);
      onTurnCreated?.(turnId);
      const initial: AgentTurn = {
        id: turnId,
        question: displayQuestion ?? question,
        steps: [],
        pendingCalls: null,
        finalText: "",
        done: false,
      };
      latestTurns.current[turnId] = initial;
      setTurns((prev) => [...prev, initial]);

      await runLoop(turnId);
      return turnId;
    },
    [runLoop]
  );

  const resolvePending = useCallback(
    async (turnId: string, decisions: Record<string, boolean>) => {
      const turn = latestTurns.current[turnId];
      if (!turn?.pendingCalls) return;

      setIsBusy(true);
      update(turnId, (t) => ({
        ...t,
        pendingCalls: null,
        steps: t.steps.map((s) =>
          s.status === "pending"
            ? { ...s, status: decisions[s.id] ? "approved" : "denied" }
            : s
        ),
      }));

      const res = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calls: turn.pendingCalls, decisions }),
      });
      const data = await res.json();

      const toolMessages: AgentMessage[] = data.results.map(
        (r: { id: string; result: unknown }) => ({
          role: "tool" as const,
          tool_call_id: r.id,
          content: JSON.stringify(r.result),
        })
      );

      transcripts.current[turnId] = [
        ...transcripts.current[turnId],
        ...toolMessages,
      ];

      update(turnId, (t) => ({
        ...t,
        steps: t.steps.map((s) => {
          const match = data.results.find((r: { id: string }) => r.id === s.id);
          if (!match) return s;
          return {
            ...s,
            status: s.status === "denied" ? "denied" : "done",
            result: JSON.stringify(match.result).slice(0, 2000),
          };
        }),
      }));

      await runLoop(turnId);
    },
    [runLoop]
  );

  const hydrate = useCallback((loaded: AgentTurn[]) => {
    setTurns(loaded);
    latestTurns.current = Object.fromEntries(loaded.map((t) => [t.id, t]));
    // Past turns are stored only once complete; there's nothing to resume.
  }, []);

  const reset = useCallback(() => {
    setTurns([]);
    latestTurns.current = {};
    transcripts.current = {};
  }, []);

  const getTurn = useCallback((id: string) => latestTurns.current[id], []);

  return { turns, ask, resolvePending, isBusy, hydrate, reset, getTurn };
}
