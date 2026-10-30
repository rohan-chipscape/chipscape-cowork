import { makeOpenAICompatibleProvider } from "./openaiCompatible";

export const askOpenAI = makeOpenAICompatibleProvider({
  provider: "openai",
  label: "GPT",
  model: "gpt-5.1",
  apiKeyEnv: "OPENAI_API_KEY",
  useMaxCompletionTokens: true,
});
