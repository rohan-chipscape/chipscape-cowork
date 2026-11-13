import path from "node:path";
import QRCode from "qrcode";

// whatsapp-web.js controls a real, persistent headless Chromium instance
// logged into web.whatsapp.com — there is no official WhatsApp API this
// uses; it automates the actual web client the same way a human would.
// This is NOT sanctioned by WhatsApp's terms of service for personal
// accounts — the account owner accepted that risk explicitly before this
// was built. See the PUPPETEER_EXECUTABLE_PATH note below for why a plain
// `npm install` alone won't make this work in production.

type ConnectionState = "idle" | "qr" | "ready" | "auth_failure" | "disconnected";

type Session = {
  client: unknown; // whatsapp-web.js Client — kept untyped to avoid pulling in its types everywhere
  state: ConnectionState;
  qrDataUrl: string | null;
  error: string | null;
};

// One real browser process per connected account, kept alive for the life
// of this server process — Next.js's standalone server runs as a single
// long-lived Node process, so a module-level map works as a singleton
// registry. This would NOT survive multiple server instances/replicas.
const sessions = new Map<string, Session>();

const SESSIONS_DIR = path.join(process.cwd(), ".data", "whatsapp-sessions");

function sanitizeClientId(email: string): string {
  // whatsapp-web.js's LocalAuth clientId ends up in a file path — keep it
  // to safe characters, same spirit as sanitizeFilename elsewhere.
  return email.replace(/[^a-zA-Z0-9]/g, "_");
}

export function getSessionStatus(email: string): { state: ConnectionState; qrDataUrl: string | null; error: string | null } {
  const session = sessions.get(email);
  if (!session) return { state: "idle", qrDataUrl: null, error: null };
  return { state: session.state, qrDataUrl: session.qrDataUrl, error: session.error };
}

export async function startSession(email: string): Promise<void> {
  const existing = sessions.get(email);
  if (existing && existing.state !== "disconnected" && existing.state !== "auth_failure") {
    return; // already connecting or connected
  }

  const { Client, LocalAuth } = await import("whatsapp-web.js");

  const session: Session = { client: null, state: "idle", qrDataUrl: null, error: null };
  sessions.set(email, session);

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: sanitizeClientId(email),
      dataPath: SESSIONS_DIR,
    }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });
  session.client = client;

  client.on("qr", async (qr: string) => {
    session.state = "qr";
    session.qrDataUrl = await QRCode.toDataURL(qr);
  });

  client.on("ready", () => {
    session.state = "ready";
    session.qrDataUrl = null;
    session.error = null;
  });

  client.on("auth_failure", (msg: string) => {
    session.state = "auth_failure";
    session.error = msg || "Authentication failed.";
  });

  client.on("disconnected", () => {
    session.state = "disconnected";
  });

  try {
    await client.initialize();
  } catch (err) {
    session.state = "auth_failure";
    session.error = err instanceof Error ? err.message : String(err);
  }
}

async function getReadyClient(email: string) {
  const session = sessions.get(email);
  if (!session || session.state !== "ready") {
    throw new Error("WhatsApp isn't connected for this account. Connect it first from the account menu.");
  }
  return session.client as import("whatsapp-web.js").Client;
}

export async function listChats(email: string, limit = 20) {
  const client = await getReadyClient(email);
  const chats = await client.getChats();
  return chats.slice(0, limit).map((c) => ({
    id: c.id._serialized,
    name: c.name,
    isGroup: c.isGroup,
    unreadCount: c.unreadCount,
    lastMessage: c.lastMessage
      ? { body: c.lastMessage.body, fromMe: c.lastMessage.fromMe, timestamp: c.lastMessage.timestamp }
      : null,
  }));
}

export async function readMessages(email: string, chatQuery: string, limit = 20) {
  const client = await getReadyClient(email);
  const chats = await client.getChats();
  const chat = chats.find((c) => c.name?.toLowerCase().includes(chatQuery.toLowerCase()));
  if (!chat) {
    return { error: `No WhatsApp chat found matching "${chatQuery}".` };
  }
  const messages = await chat.fetchMessages({ limit });
  return {
    chatName: chat.name,
    messages: messages.map((m) => ({
      fromMe: m.fromMe,
      author: m.author,
      body: m.body,
      timestamp: m.timestamp,
    })),
  };
}

export async function sendMessage(email: string, chatQuery: string, text: string) {
  const client = await getReadyClient(email);
  const chats = await client.getChats();
  const chat = chats.find((c) => c.name?.toLowerCase().includes(chatQuery.toLowerCase()));
  if (!chat) {
    return { error: `No WhatsApp chat found matching "${chatQuery}".` };
  }
  await client.sendMessage(chat.id._serialized, text);
  return { sent: true, chatName: chat.name };
}
