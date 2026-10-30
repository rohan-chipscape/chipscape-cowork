import type { Turn } from "@/lib/useDebateChat";
import type { AgentTurn } from "@/lib/useAgentChat";
import type { StoredTurn } from "./types";

type OrderEntry = { kind: "debate" | "agent"; id: string };

export function toStoredDebateTurn(t: Turn): StoredTurn {
  return {
    kind: "debate",
    id: t.id,
    question: t.question,
    panel: t.panel.map((p) => ({
      id: p.id,
      label: p.label,
      status: p.status === "error" ? "error" : "done",
      text: p.text,
      latencyMs: p.latencyMs,
      error: p.error,
    })),
    finalText: t.finalText,
    judgeLabel: t.judgeLabel,
    synthesisError: t.synthesisError,
  };
}

export function toStoredAgentTurn(t: AgentTurn): StoredTurn {
  return {
    kind: "agent",
    id: t.id,
    question: t.question,
    steps: t.steps,
    finalText: t.finalText,
    error: t.error,
  };
}

export function serializeTurns(
  order: OrderEntry[],
  debateTurns: Turn[],
  agentTurns: AgentTurn[]
): StoredTurn[] {
  return order
    .map((entry): StoredTurn | null => {
      if (entry.kind === "debate") {
        const t = debateTurns.find((x) => x.id === entry.id);
        return t ? toStoredDebateTurn(t) : null;
      }
      const t = agentTurns.find((x) => x.id === entry.id);
      return t ? toStoredAgentTurn(t) : null;
    })
    .filter((t): t is StoredTurn => t !== null);
}

export function deserializeTurns(stored: StoredTurn[]): {
  order: OrderEntry[];
  debate: Turn[];
  agent: AgentTurn[];
} {
  const order: OrderEntry[] = [];
  const debate: Turn[] = [];
  const agent: AgentTurn[] = [];

  for (const t of stored) {
    order.push({ kind: t.kind, id: t.id });
    if (t.kind === "debate") {
      debate.push({
        id: t.id,
        question: t.question,
        panel: t.panel.map((p) => ({
          id: p.id,
          label: p.label,
          status: p.status,
          text: p.text,
          latencyMs: p.latencyMs,
          error: p.error,
        })),
        synthesizing: false,
        finalText: t.finalText,
        judgeLabel: t.judgeLabel,
        synthesisError: t.synthesisError,
        done: true,
      });
    } else {
      agent.push({
        id: t.id,
        question: t.question,
        steps: t.steps,
        pendingCalls: null,
        finalText: t.finalText,
        error: t.error,
        done: true,
      });
    }
  }

  return { order, debate, agent };
}
