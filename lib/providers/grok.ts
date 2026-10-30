import { makeOpenAICompatibleProvider } from "./openaiCompatible";

export const askGrok = makeOpenAICompatibleProvider({
  provider: "grok",
  label: "Grok",
  model: "grok-4",
  apiKeyEnv: "XAI_API_KEY",
  baseURL: "https://api.x.ai/v1",
});
