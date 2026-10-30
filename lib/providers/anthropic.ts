import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, ProviderResult } from "./types";

const MODEL = "claude-sonnet-5-5";

export async function askAnthropic(
  history: ChatMessage[],
  systemPrompt?: string
): Promise<ProviderResult> {
  const start = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return fail("ANTHROPIC_API_KEY is not set");
  }
  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return {
      provider: "anthropic",
      label: "Claude",
      model: MODEL,
      text,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }

  function fail(message: string): ProviderResult {
    return {
      provider: "anthropic",
      label: "Claude",
      model: MODEL,
      text: "",
      latencyMs: Date.now() - start,
      error: message,
    };
  }
}
