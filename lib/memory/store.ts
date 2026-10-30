import fs from "node:fs";
import path from "node:path";

// Persistent, cross-chat memory — unlike conversation history, these facts
// are available in every chat, including brand-new ones. Single-user tool,
// so one flat file is enough.
const FILE_PATH = path.join(process.cwd(), ".data", "memory.json");

// Bounds how much gets injected into every single prompt — without this,
// weeks of auto-captured facts would keep growing the context (and cost) of
// every future chat forever. Oldest facts age out once the cap is hit.
const MAX_FACTS = 80;

export type Fact = {
  id: string;
  text: string;
  createdAt: string;
};

function ensureDir() {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
}

export function listFacts(): Fact[] {
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function writeFacts(facts: Fact[]) {
  ensureDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(facts, null, 2));
}

export function addFact(text: string): Fact {
  const facts = listFacts();

  // Cheap de-dupe: skip near-identical facts already stored.
  const normalized = text.trim().toLowerCase();
  const alreadyKnown = facts.some(
    (f) => f.text.trim().toLowerCase() === normalized
  );
  if (alreadyKnown) {
    return facts.find((f) => f.text.trim().toLowerCase() === normalized)!;
  }

  const fact: Fact = {
    id: crypto.randomUUID(),
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  const next = [...facts, fact].slice(-MAX_FACTS);
  writeFacts(next);
  return fact;
}

export function removeFact(id: string) {
  writeFacts(listFacts().filter((f) => f.id !== id));
}
