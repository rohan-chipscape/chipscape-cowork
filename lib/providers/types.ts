export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ProviderId = "anthropic" | "openai" | "gemini" | "deepseek" | "grok";

export type ProviderResult = {
  provider: ProviderId;
  label: string;
  model: string;
  text: string;
  latencyMs: number;
  error?: string;
};

export type ProviderFn = (
  history: ChatMessage[],
  systemPrompt?: string
) => Promise<ProviderResult>;
