import { makeOpenAICompatibleProvider } from "./openaiCompatible";

export const askDeepseek = makeOpenAICompatibleProvider({
  provider: "deepseek",
  label: "DeepSeek",
  model: "deepseek-chat",
  apiKeyEnv: "DEEPSEEK_API_KEY",
  baseURL: "https://api.deepseek.com",
});
