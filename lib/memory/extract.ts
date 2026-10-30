import { getAgentClient } from "@/lib/agent/client";

/**
 * Looks at one finished exchange and pulls out anything worth carrying into
 * EVERY future chat — not just static facts (name, role, a colleague's
 * email) but also what the CEO is currently working on, decisions made, and
 * how he likes things done. This is what makes a brand-new chat feel like a
 * continuation instead of starting over, the way ChatGPT's own memory does.
 * Returns an empty array for one-off exchanges with nothing worth keeping.
 */
export async function extractFacts(
  question: string,
  answer: string
): Promise<string[]> {
  try {
    const { client, model } = getAgentClient();
    const res = await client.chat.completions.create({
      model,
      max_completion_tokens: 220,
      messages: [
        {
          role: "system",
          content:
            "You watch one exchange between a CEO and an assistant and decide what's worth carrying " +
            "into EVERY future conversation with him, so a brand-new chat still feels like a continuation " +
            "rather than starting from zero. Capture things like:\n" +
            "- Who he is, his role, colleagues (names/emails/roles), company facts.\n" +
            "- What he's currently working on or just did (a project, a task, a decision made, something " +
            "sent/scheduled) — so future chats know the current context, not just static trivia.\n" +
            "- How he likes things done (tone, format, standing preferences).\n" +
            "Do NOT save simple one-off factual questions with no lasting relevance (e.g. 'what's 12*7', " +
            "general knowledge questions with no connection to him or his work).\n" +
            "Reply with each worthwhile item on its own line, third person, each under 150 characters " +
            "(e.g. \"Asked the agent to email agasthya@chipscape.ai about the Q4 board deck.\"). " +
            "If there's truly nothing worth keeping, reply with exactly NONE and nothing else.",
        },
        {
          role: "user",
          content: `User asked: ${question}\n\nAssistant answered: ${answer.slice(0, 2000)}`,
        },
      ],
    });

    const text = res.choices[0]?.message?.content?.trim() ?? "";
    if (!text || text.toUpperCase() === "NONE") return [];

    return text
      .split("\n")
      .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
      .filter((line) => line && line.toUpperCase() !== "NONE")
      .map((line) => line.slice(0, 200))
      .slice(0, 5);
  } catch {
    // Memory extraction is best-effort — never let it break the chat.
    return [];
  }
}
