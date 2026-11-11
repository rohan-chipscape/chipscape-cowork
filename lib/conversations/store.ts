import fs from "node:fs";
import path from "node:path";
import type { AdminConversationSummary, Conversation, ConversationSummary } from "./types";

// Single-user internal tool: conversations are small and few, so one JSON
// file per conversation is simpler than standing up a database.
const DIR = path.join(process.cwd(), ".data", "conversations");

// Conversations created before per-account chat history existed have no
// ownerEmail on disk. Rather than orphan that history, it's attributed to
// whichever account was actually used throughout this app's build/testing.
const LEGACY_OWNER = "rohan@chipscape.com";

function ensureDir() {
  fs.mkdirSync(DIR, { recursive: true });
}

function filePath(id: string) {
  return path.join(DIR, `${id}.json`);
}

function ownedBy(conv: Conversation, ownerEmail: string): boolean {
  return (conv.ownerEmail ?? LEGACY_OWNER) === ownerEmail;
}

export function listConversations(ownerEmail: string): ConversationSummary[] {
  ensureDir();
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
  const summaries = files
    .map((f) => {
      const raw = fs.readFileSync(path.join(DIR, f), "utf-8");
      return JSON.parse(raw) as Conversation;
    })
    .filter((conv) => ownedBy(conv, ownerEmail))
    .map((conv) => ({ id: conv.id, title: conv.title, updatedAt: conv.updatedAt }));
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Admin-only: every conversation from every account, not just one owner's.
 * Used solely by the admin view gated behind isAdminSession(). */
export function listAllConversations(): AdminConversationSummary[] {
  ensureDir();
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
  const summaries = files
    .map((f) => {
      const raw = fs.readFileSync(path.join(DIR, f), "utf-8");
      return JSON.parse(raw) as Conversation;
    })
    .map((conv) => ({
      id: conv.id,
      title: conv.title,
      updatedAt: conv.updatedAt,
      ownerEmail: conv.ownerEmail ?? LEGACY_OWNER,
      ownerName: conv.ownerName,
    }));
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Admin-only: read any conversation regardless of who owns it. */
export function getConversationAnyOwner(id: string): Conversation | null {
  try {
    const raw = fs.readFileSync(filePath(id), "utf-8");
    return JSON.parse(raw) as Conversation;
  } catch {
    return null;
  }
}

/** Does a conversation with this id exist at all, regardless of owner? Used
 * to stop a PUT from silently re-creating (and reassigning the owner of) a
 * conversation id that already belongs to someone else. */
export function conversationExists(id: string): boolean {
  return fs.existsSync(filePath(id));
}

export function getConversation(id: string, ownerEmail: string): Conversation | null {
  try {
    const raw = fs.readFileSync(filePath(id), "utf-8");
    const conv = JSON.parse(raw) as Conversation;
    return ownedBy(conv, ownerEmail) ? conv : null;
  } catch {
    return null;
  }
}

export function saveConversation(conv: Conversation) {
  ensureDir();
  fs.writeFileSync(filePath(conv.id), JSON.stringify(conv, null, 2));
}

export function deleteConversation(id: string, ownerEmail: string) {
  const existing = getConversation(id, ownerEmail);
  if (!existing) return; // doesn't exist, or isn't this account's to delete
  try {
    fs.unlinkSync(filePath(id));
  } catch {
    // already gone
  }
}
