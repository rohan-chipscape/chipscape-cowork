import fs from "node:fs";
import path from "node:path";
import type { Conversation, ConversationSummary } from "./types";

// Single-user internal tool: conversations are small and few, so one JSON
// file per conversation is simpler than standing up a database.
const DIR = path.join(process.cwd(), ".data", "conversations");

function ensureDir() {
  fs.mkdirSync(DIR, { recursive: true });
}

function filePath(id: string) {
  return path.join(DIR, `${id}.json`);
}

export function listConversations(): ConversationSummary[] {
  ensureDir();
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
  const summaries = files.map((f) => {
    const raw = fs.readFileSync(path.join(DIR, f), "utf-8");
    const conv = JSON.parse(raw) as Conversation;
    return { id: conv.id, title: conv.title, updatedAt: conv.updatedAt };
  });
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getConversation(id: string): Conversation | null {
  try {
    const raw = fs.readFileSync(filePath(id), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveConversation(conv: Conversation) {
  ensureDir();
  fs.writeFileSync(filePath(conv.id), JSON.stringify(conv, null, 2));
}

export function deleteConversation(id: string) {
  try {
    fs.unlinkSync(filePath(id));
  } catch {
    // already gone
  }
}
