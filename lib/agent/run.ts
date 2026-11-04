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
  history: AgentMessage[],
  sessionEmail: string | null
): Promise<AgentStepResult> {
  const { client, model } = getAgentClient();

  const res = await client.chat.completions.create({
    model,
    max_completion_tokens: 1500,
    tools: getAgentTools(sessionEmail),
    tool_choice: "auto",
    messages: [
      { role: "system", content: getAgentSystemPrompt(sessionEmail) },
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

// Explicit requests to search/research/look something up are an unambiguous
// signal for Agent mode — don't leave these to the LLM classifier's
// judgment call, since it occasionally misfires on identically-intentioned
// phrasing. This is checked before the LLM call, not instead of it.
const EXPLICIT_RESEARCH_PATTERN =
  /\b(do(ing)?\s+(a\s+|some\s+)?rese?a?search|rese?a?search\s+(this|that|it)|search\s+(the\s+)?(web|online|internet)|search\s+for|look\s+(it\s+)?up|look\s+up|find\s+out|browse\s+the\s+web|google\s+(it|this|that))\b/i;

export async function classifyIntent(
  question: string
): Promise<"agent" | "debate"> {
  if (EXPLICIT_RESEARCH_PATTERN.test(question)) {
    return "agent";
  }

  const { client, model } = getAgentClient();

  const res = await client.chat.completions.create({
    model,
    max_completion_tokens: 20,
    messages: [
      {
        role: "system",
        content:
          "Classify the user's message as exactly one word: AGENT or DEBATE.\n" +
          "DEBATE is the default — use it for any question, opinion, analysis, explanation, advice, or " +
          "request for ideas/recommendations, even if it mentions 'today' or sounds time-sensitive (e.g. " +
          "'what's today's date', 'best stock to buy today', 'what should I focus on this week'). A panel " +
          "of models will reason about it from general knowledge; that's the whole point of this app, so " +
          "don't route away from it just because a sharper answer could theoretically use fresh data.\n" +
          "AGENT is the exception — use it ONLY when the request clearly can't be done without actually " +
          "calling a tool: searching the live web for something specific, fetching/reading a named URL, " +
          "running a calculation/code, checking/sending email, checking/creating a calendar event, " +
          "writing/drafting a document, report, memo, or PDF file to hand back as a download, or " +
          "generating/creating/drawing an image, picture, logo, or illustration.\n" +
          "If in doubt, choose DEBATE.\n" +
          "Reply with only one word: AGENT or DEBATE.",
      },
      { role: "user", content: question },
    ],
  });

  const answer = res.choices[0]?.message?.content?.trim().toUpperCase() ?? "";
  return answer.includes("AGENT") ? "agent" : "debate";
}
