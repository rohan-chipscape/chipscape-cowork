import OpenAI from "openai";
import type { ChatMessage, ProviderId, ProviderResult } from "./types";

type Config = {
  provider: ProviderId;
  label: string;
  model: string;
  apiKeyEnv: string;
  baseURL?: string;
  useMaxCompletionTokens?: boolean;
};

export function makeOpenAICompatibleProvider(config: Config) {
  return async function ask(
    history: ChatMessage[],
    systemPrompt?: string
  ): Promise<ProviderResult> {
    const start = Date.now();
    const apiKey = process.env[config.apiKeyEnv];
    const fail = (message: string): ProviderResult => ({
      provider: config.provider,
      label: config.label,
      model: config.model,
      text: "",
      latencyMs: Date.now() - start,
      error: message,
    });

    if (!apiKey) {
      return fail(`${config.apiKeyEnv} is not set`);
    }

    try {
      const client = new OpenAI({ apiKey, baseURL: config.baseURL });
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      for (const m of history) {
        messages.push({ role: m.role, content: m.content });
      }
      const res = await client.chat.completions.create({
        model: config.model,
        messages,
        ...(config.useMaxCompletionTokens
          ? { max_completion_tokens: 1500 }
          : { max_tokens: 1500 }),
      });
      const text = res.choices[0]?.message?.content ?? "";
      return {
        provider: config.provider,
        label: config.label,
        model: config.model,
        text,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  };
}
