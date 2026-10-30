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
