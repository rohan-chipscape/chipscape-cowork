import type { ChatMessage, ProviderResult } from "./providers/types";
import { buildMemoryBlock } from "./memory/context";

export function buildPanelSystemPrompt(): string {
  return (
    "You are one voice in a panel of AI models answering a question for a CEO. " +
    "Give your best, direct, well-reasoned answer to the user's question. Be concise but complete. " +
    "Do not mention that you are part of a panel or debate.\n" +
    "You have no access to the user's live WhatsApp, email, calendar, files, or any other connected " +
    "account or tool — none of that was fetched for this question, regardless of what it or earlier " +
    "parts of the conversation might suggest. If the question depends on that kind of live personal data, " +
    "say plainly that you can't check it in this mode and the user should ask again normally so it can be " +
    "looked up. Never claim or imply that an earlier answer elsewhere in the conversation was fake, " +
    "hallucinated, or should be disregarded — you have no way of knowing what tools that answer did or " +
    "didn't use, and a wrong guess here is far more damaging than simply not answering." +
    buildMemoryBlock()
  );
}

export function buildSynthesisPrompt(
  question: string,
  results: ProviderResult[]
): ChatMessage[] {
  const successful = results.filter((r) => !r.error && r.text.trim());

  const answersBlock = successful
    .map((r, i) => `### Answer ${i + 1} — from ${r.label}\n${r.text.trim()}`)
    .join("\n\n");

  const failedNote =
    results.length > successful.length
      ? `\n\n(Note: ${results.length - successful.length} model(s) failed to respond and are excluded.)`
      : "";

  const content =
    `A CEO asked the following question:\n"""${question}"""\n\n` +
    `${successful.length} different AI models independently answered it. Their answers:\n\n${answersBlock}${failedNote}\n\n` +
    "As the lead analyst, do the following:\n" +
    "1. Identify where the answers agree and where they genuinely disagree or add unique value.\n" +
    "2. Resolve disagreements using your own best judgment — don't just average them.\n" +
    "3. Produce ONE final, best possible answer to the CEO's original question: clear, direct, decision-useful, " +
    "and free of hedging about 'the panel'. Write it as if you are answering the CEO directly yourself.\n" +
    "4. Keep a short 'Key considerations' section only if it adds real decision value; skip it for simple factual questions.\n\n" +
    "Do not mention the panel, debate, voting, or other models in your final answer — just give the best answer. " +
    "None of these models had access to the user's live WhatsApp, email, calendar, or files — if the answers " +
    "say they can't check that, say so plainly yourself too, and never claim an earlier answer elsewhere in " +
    "the conversation was fake or should be disregarded; you have no way of knowing what that answer actually used.";

  return [{ role: "user", content }];
}

export function buildSynthesisSystemPrompt(): string {
  return (
    "You are the lead analyst synthesizing multiple expert opinions into one authoritative, " +
    "confident final answer for a CEO. Never reveal your internal process or mention other AI models." +
    buildMemoryBlock()
  );
}
