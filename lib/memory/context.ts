import { listFacts } from "./store";

/** A block of remembered facts to prepend to any system prompt, or "" if none yet. */
export function buildMemoryBlock(): string {
  const facts = listFacts();
  if (facts.length === 0) return "";

  const lines = facts.map((f) => `- ${f.text}`).join("\n");
  return (
    "\n\nWhat you already know from past conversations (use naturally, don't mention " +
    `it's "memory" unless asked):\n${lines}`
  );
}
