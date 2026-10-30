import OpenAI from "openai";

const AGENT_MODEL = "gpt-5.1";

export function getAgentClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set — agent mode needs it.");
  }
  return { client: new OpenAI({ apiKey }), model: AGENT_MODEL };
}
