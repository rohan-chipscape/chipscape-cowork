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
  // The Google account that created this chat — scopes chat history per
  // signed-in account, same as ChatGPT. Optional only because conversations
  // created before this field existed don't have it (see LEGACY_OWNER).
  ownerEmail?: string;
  // The display name Google gave at sign-in, captured alongside ownerEmail
  // purely so the admin view can show a human name instead of a bare email.
  ownerName?: string;
};

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

// Same as ConversationSummary, but for the admin-only "every account's
// conversations" listing, which also needs to say whose chat each one is.
export type AdminConversationSummary = ConversationSummary & {
  ownerEmail: string;
  ownerName?: string;
};
