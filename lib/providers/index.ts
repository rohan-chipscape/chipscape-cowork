import { askAnthropic } from "./anthropic";
import { askOpenAI } from "./openai";
import { askGemini } from "./gemini";
import { askDeepseek } from "./deepseek";
import { askGrok } from "./grok";
import type { ProviderFn, ProviderId } from "./types";

export const PROVIDERS: { id: ProviderId; label: string; fn: ProviderFn }[] = [
  { id: "anthropic", label: "Claude", fn: askAnthropic },
  { id: "openai", label: "GPT", fn: askOpenAI },
  { id: "gemini", label: "Gemini", fn: askGemini },
  { id: "deepseek", label: "DeepSeek", fn: askDeepseek },
  { id: "grok", label: "Grok", fn: askGrok },
];

export * from "./types";
