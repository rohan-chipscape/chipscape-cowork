// Talks to WhatsApp directly over the same WebSocket protocol WhatsApp's own
// apps use (via the Baileys library) — no browser, no Chromium, no Puppeteer.
// We tried whatsapp-web.js first (it drives a real headless Chromium
// pretending to be a human using web.whatsapp.com); across several real
// pairing attempts it consistently got stuck between the phone accepting
// the scan and the library ever confirming the connection — a currently
// open, widely-reported bug in that library, not something fixable on our
// end. Baileys doesn't depend on reverse-engineering WhatsApp Web's actual
// frontend, so it isn't exposed to that whole class of breakage.
import path from "node:path";
import QRCode from "qrcode";

type ConnectionState = "idle" | "qr" | "ready" | "auth_failure" | "disconnected";

type StoredMessage = { fromMe: boolean; author: string | null; body: string; timestamp: number };

type ChatRecord = {
  id: string;
  name: string | null;
  isGroup: boolean;
  unreadCount: number;
  lastMessage: { body: string; fromMe: boolean; timestamp: number } | null;
  messages: StoredMessage[];
};

type Session = {
  sock: unknown;
  state: ConnectionState;
  qrDataUrl: string | null;
  error: string | null;
  chats: Map<string, ChatRecord>;
  // Chat history often arrives with no usable name (especially for newer
  // "@lid" contact ids and groups) — contact push-names and group subjects
  // arrive separately, sometimes before the chat record even exists, so
  // this is tracked independently and consulted whenever a chat's own name
  // is still missing.
  names: Map<string, string>;
  groupMetadataRequested: Set<string>;
};

// One real WhatsApp connection per account, kept alive for the life of this
// server process — see the note in startSession() about why this doesn't
// survive multiple server replicas.
const sessions = new Map<string, Session>();
const SESSIONS_DIR = path.join(process.cwd(), ".data", "whatsapp-sessions");

function sanitizeClientId(email: string): string {
  return email.replace(/[^a-zA-Z0-9]/g, "_");
}

export function getSessionStatus(email: string): { state: ConnectionState; qrDataUrl: string | null; error: string | null } {
  const session = sessions.get(email);
  if (!session) return { state: "idle", qrDataUrl: null, error: null };
  return { state: session.state, qrDataUrl: session.qrDataUrl, error: session.error };
}

function extractBody(message: Record<string, unknown> | null | undefined): string {
  if (!message) return "";
  const m = message as Record<string, { text?: string; caption?: string } | string | undefined>;
  if (typeof m.conversation === "string") return m.conversation;
  const extended = m.extendedTextMessage as { text?: string } | undefined;
  if (extended?.text) return extended.text;
  const image = m.imageMessage as { caption?: string } | undefined;
  if (image?.caption) return image.caption;
  const video = m.videoMessage as { caption?: string } | undefined;
  if (video?.caption) return video.caption;
  return "[media]";
}

function resolveName(session: Session, chat: ChatRecord): string {
  return chat.name || session.names.get(chat.id) || chat.id;
}

function upsertMessage(session: Session, m: Record<string, unknown>) {
  const key = m.key as { remoteJid?: string; fromMe?: boolean; participant?: string } | undefined;
  const jid = key?.remoteJid;
  if (!jid) return;
  let chat = session.chats.get(jid);
  if (!chat) {
    chat = { id: jid, name: session.names.get(jid) || null, isGroup: jid.endsWith("@g.us"), unreadCount: 0, lastMessage: null, messages: [] };
    session.chats.set(jid, chat);
  }
  const pushName = m.pushName as string | undefined;
  if (pushName && !key?.fromMe && !session.names.has(jid)) {
    session.names.set(jid, pushName);
    if (!chat.name) chat.name = pushName;
  }
  const body = extractBody(m.message as Record<string, unknown> | undefined);
  const timestamp = Number(m.messageTimestamp) || Math.floor(Date.now() / 1000);
  const entry: StoredMessage = {
    fromMe: !!key?.fromMe,
    author: key?.participant || (key?.fromMe ? "me" : jid),
    body,
    timestamp,
  };
  chat.messages.push(entry);
  if (chat.messages.length > 200) chat.messages.shift();
  chat.lastMessage = { body, fromMe: entry.fromMe, timestamp };
}

export async function startSession(email: string): Promise<void> {
  const existing = sessions.get(email);
  if (existing && existing.state !== "disconnected" && existing.state !== "auth_failure") {
    return; // already connecting or connected
  }

  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = await import("@whiskeysockets/baileys");

  const { state: authState, saveCreds } = await useMultiFileAuthState(
    path.join(SESSIONS_DIR, sanitizeClientId(email))
  );

  const session: Session = {
    sock: null,
    state: "idle",
    qrDataUrl: null,
    error: null,
    chats: new Map(),
    names: new Map(),
    groupMetadataRequested: new Set(),
  };
  sessions.set(email, session);

  const sock = makeWASocket({ auth: authState, printQRInTerminal: false, syncFullHistory: true });
  session.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update: Record<string, unknown>) => {
    const qr = update.qr as string | undefined;
    const connection = update.connection as string | undefined;
    const lastDisconnect = update.lastDisconnect as { error?: { output?: { statusCode?: number }; message?: string } } | undefined;

    if (qr) {
      session.state = "qr";
      session.qrDataUrl = await QRCode.toDataURL(qr);
    }
    if (connection === "open") {
      session.state = "ready";
      session.qrDataUrl = null;
      session.error = null;
    }
    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      session.state = loggedOut ? "disconnected" : "auth_failure";
      session.error = loggedOut ? null : lastDisconnect?.error?.message || "Connection closed unexpectedly.";
    }
  });

  function rememberName(jid: string, name: string | undefined | null) {
    if (!name) return;
    session.names.set(jid, name);
    const chat = session.chats.get(jid);
    if (chat && !chat.name) chat.name = name;
  }

  function ensureGroupName(jid: string) {
    if (!jid.endsWith("@g.us") || session.groupMetadataRequested.has(jid)) return;
    session.groupMetadataRequested.add(jid);
    (sock as { groupMetadata: (jid: string) => Promise<{ subject?: string }> })
      .groupMetadata(jid)
      .then((meta) => rememberName(jid, meta?.subject))
      .catch(() => {});
  }

  sock.ev.on("messaging-history.set", (data: Record<string, unknown>) => {
    const chats = (data.chats as Array<{ id: string; name?: string; unreadCount?: number }>) || [];
    const messages = (data.messages as Array<Record<string, unknown>>) || [];
    for (const c of chats) {
      const existing = session.chats.get(c.id) ?? {
        id: c.id,
        name: session.names.get(c.id) || null,
        isGroup: c.id.endsWith("@g.us"),
        unreadCount: 0,
        lastMessage: null,
        messages: [],
      };
      existing.name = c.name || existing.name;
      existing.unreadCount = c.unreadCount ?? existing.unreadCount;
      session.chats.set(c.id, existing);
      if (!existing.name) ensureGroupName(c.id);
    }
    for (const m of messages) upsertMessage(session, m);
  });

  sock.ev.on("contacts.upsert", (contacts: Array<{ id: string; name?: string; notify?: string; verifiedName?: string }>) => {
    for (const c of contacts) {
      rememberName(c.id, c.name || c.verifiedName || c.notify);
    }
  });

  sock.ev.on("groups.upsert", (groups: Array<{ id: string; subject?: string }>) => {
    for (const g of groups) rememberName(g.id, g.subject);
  });

  sock.ev.on("messages.upsert", (data: Record<string, unknown>) => {
    const messages = (data.messages as Array<Record<string, unknown>>) || [];
    for (const m of messages) {
      upsertMessage(session, m);
      const jid = (m.key as { remoteJid?: string } | undefined)?.remoteJid;
      if (jid) ensureGroupName(jid);
    }
  });
}

async function getReadySession(email: string): Promise<Session> {
  const session = sessions.get(email);
  if (!session || session.state !== "ready") {
    throw new Error("WhatsApp isn't connected for this account. Connect it first from the account menu.");
  }
  return session;
}

function findChat(session: Session, chatQuery: string): ChatRecord | undefined {
  const query = chatQuery.toLowerCase();
  return Array.from(session.chats.values()).find((c) => resolveName(session, c).toLowerCase().includes(query));
}

export async function listChats(email: string, limit = 20) {
  const session = await getReadySession(email);
  return Array.from(session.chats.values())
    .sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0))
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      name: resolveName(session, c),
      isGroup: c.isGroup,
      unreadCount: c.unreadCount,
      lastMessage: c.lastMessage,
    }));
}

export async function readMessages(email: string, chatQuery: string, limit = 20) {
  const session = await getReadySession(email);
  const chat = findChat(session, chatQuery);
  if (!chat) return { error: `No WhatsApp chat found matching "${chatQuery}".` };
  return { chatName: resolveName(session, chat), messages: chat.messages.slice(-limit) };
}

export async function sendMessage(email: string, chatQuery: string, text: string) {
  const session = await getReadySession(email);
  const chat = findChat(session, chatQuery);
  if (!chat) return { error: `No WhatsApp chat found matching "${chatQuery}".` };
  await (session.sock as { sendMessage: (jid: string, content: { text: string }) => Promise<unknown> }).sendMessage(
    chat.id,
    { text }
  );
  return { sent: true, chatName: resolveName(session, chat) };
}
