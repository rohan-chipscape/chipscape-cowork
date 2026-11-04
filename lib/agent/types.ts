export type AgentToolCall = {
  id: string;
  name: string;
  arguments: string; // raw JSON string, as returned by the model
};

export type AgentMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: AgentToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type AgentStepResult =
  | { type: "final"; text: string }
  | { type: "tool_calls"; calls: AgentToolCall[] };

// Tools that actually change something outside the app (sending an email,
// creating a calendar event) require explicit approval before running.
// Read-only/generative tools (search, fetch, document/image generation) run
// immediately, same as ChatGPT's own browsing/tool use.
export const SIDE_EFFECT_TOOLS = new Set(["gmail_send", "calendar_create_event"]);
