// The server used to run whatsapp-web.js (a real, persistent headless
// Chromium instance logged into web.whatsapp.com) directly here. That broke
// in production: WhatsApp's own anti-abuse system silently rejects pairing
// attempts from datacenter/VPS IPs, so the QR looked fine but the phone
// could never actually link. The account owner's own ChatGPT "computer use"
// worked because it drove a browser on THEIR computer over THEIR normal
// internet connection — not a server in a datacenter.
//
// So now the real automation runs in a small companion app the account
// owner runs on their own computer (see /whatsapp-companion), and this
// module just relays commands to it and reports back whatever state it
// pushes to us. See lib/whatsapp/relay.ts for the relay itself.
import { getStatus, sendCommand } from "./relay";

export function getSessionStatus(email: string) {
  return getStatus(email);
}

export async function listChats(email: string, limit = 20) {
  return sendCommand(email, "listChats", { limit });
}

export async function readMessages(email: string, chatQuery: string, limit = 20) {
  return sendCommand(email, "readMessages", { chatQuery, limit });
}

export async function sendMessage(email: string, chatQuery: string, text: string) {
  return sendCommand(email, "sendMessage", { chatQuery, text });
}
