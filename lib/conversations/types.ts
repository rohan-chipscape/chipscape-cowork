export type StoredPanelEntry = {
  id: string;
  label: string;
  status: "done" | "error";
  text: string;
  latencyMs?: number;
  error?: string;
};

export type StoredDebateTurn = {
  kind: "debate";
  id: string;
  question: string;
  panel: StoredPanelEntry[];
  finalText: string;
  judgeLabel?: string;
  synthesisError?: string;
};

export type StoredAgentStep = {
  id: string;
  name: string;
  args: string;
  status: "pending" | "approved" | "denied" | "done" | "error";
  result?: string;
};

export type StoredAgentTurn = {
  kind: "agent";
  id: string;
  question: string;
  steps: StoredAgentStep[];
  finalText: string;
  error?: string;
};

export type StoredTurn = StoredDebateTurn | StoredAgentTurn;

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  order: { kind: "debate" | "agent"; id: string }[];
  turns: StoredTurn[];
};

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};
