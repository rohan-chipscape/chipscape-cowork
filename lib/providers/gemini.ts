import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatMessage, ProviderResult } from "./types";

const MODEL = "gemini-pro-latest";

export async function askGemini(
  history: ChatMessage[],
  systemPrompt?: string
): Promise<ProviderResult> {
  const start = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  const fail = (message: string): ProviderResult => ({
    provider: "gemini",
    label: "Gemini",
    model: MODEL,
    text: "",
    latencyMs: Date.now() - start,
    error: message,
  });

  if (!apiKey) {
    return fail("GEMINI_API_KEY is not set");
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: systemPrompt,
    });
    const last = history[history.length - 1];
    const priorTurns = history.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const chat = model.startChat({ history: priorTurns });
    const res = await chat.sendMessage(last.content);
    const text = res.response.text();
    return {
      provider: "gemini",
      label: "Gemini",
      model: MODEL,
      text,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}
