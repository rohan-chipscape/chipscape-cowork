import type OpenAI from "openai";
import { getAgentClient } from "./client";
import { getAgentSystemPrompt, getAgentTools } from "./tools";
import type { AgentMessage, AgentStepResult } from "./types";

function toOpenAIMessages(
  history: AgentMessage[]
): OpenAI.Chat.ChatCompletionMessageParam[] {
  return history.map((m): OpenAI.Chat.ChatCompletionMessageParam => {
    if (m.role === "assistant") {
      return {
        role: "assistant",
        content: m.content,
        tool_calls: m.tool_calls?.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    if (m.role === "tool") {
      return { role: "tool", tool_call_id: m.tool_call_id, content: m.content };
    }
    return { role: "user", content: m.content };
  });
}

export async function runAgentStep(
  history: AgentMessage[]
): Promise<AgentStepResult> {
  const { client, model } = getAgentClient();

  const res = await client.chat.completions.create({
    model,
    max_completion_tokens: 1500,
    tools: getAgentTools(),
    tool_choice: "auto",
    messages: [
      { role: "system", content: getAgentSystemPrompt() },
      ...toOpenAIMessages(history),
    ],
  });

  const message = res.choices[0]?.message;

  if (message?.tool_calls?.length) {
    return {
      type: "tool_calls",
      calls: message.tool_calls
        .filter((tc) => tc.type === "function")
        .map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        })),
    };
  }

  return { type: "final", text: message?.content ?? "" };
}

export async function classifyIntent(
  question: string
): Promise<"agent" | "debate"> {
  const { client, model } = getAgentClient();

  const res = await client.chat.completions.create({
    model,
    max_completion_tokens: 20,
    messages: [
      {
        role: "system",
        content:
          "Classify the user's message as exactly one word: AGENT or DEBATE.\n" +
          "AGENT: the request needs current/real-time information, searching or reading a web page, " +
          "running a calculation/code, or taking some action.\n" +
          "DEBATE: the request is a question, opinion, analysis, or advice that can be answered from " +
          "general knowledge and reasoning alone, with no need to search, fetch, or compute.\n" +
          "Reply with only one word: AGENT or DEBATE.",
      },
      { role: "user", content: question },
    ],
  });

  const answer = res.choices[0]?.message?.content?.trim().toUpperCase() ?? "";
  return answer.includes("AGENT") ? "agent" : "debate";
}
