// Runs the real WhatsApp Web automation here, on this computer, over this
// computer's own normal internet connection — that's the whole point. When
// the same automation ran on a cloud server, WhatsApp's anti-abuse system
// silently rejected the pairing because it came from a datacenter IP. A
// normal home/office connection doesn't trigger that.
//
// This talks to the Chipscape Cowork server purely to relay commands
// ("check my chats", "send this message") and report connection status —
// it never sends your WhatsApp messages anywhere except back to your own
// Cowork account.
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const QRCode = require("qrcode");
const qrcodeTerminal = require("qrcode-terminal");

const CONFIG_PATH = path.join(__dirname, "config.json");

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

async function loadOrCreateConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  }
  console.log("First-time setup — this is saved locally in config.json, never sent anywhere else.\n");
  const email = await ask("Your Cowork email: ");
  const password = await ask("Your Cowork app password (same one you use to log into Cowork): ");
  const serverUrlRaw = await ask("Cowork server URL [https://cowork.chipscape.ai]: ");
  const serverUrl = serverUrlRaw || "https://cowork.chipscape.ai";
  const config = { email, password, serverUrl };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log("\nSaved. You won't be asked again — delete config.json to reset.\n");
  return config;
}

async function postJson(serverUrl, pathname, body) {
  const res = await fetch(`${serverUrl}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${pathname} -> HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const { email, password, serverUrl } = await loadOrCreateConfig();

  const { Client, LocalAuth } = require("whatsapp-web.js");
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: email.replace(/[^a-zA-Z0-9]/g, "_"),
      dataPath: path.join(__dirname, "session"),
    }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  let ready = false;

  client.on("qr", async (qr) => {
    console.log("\nScan this with WhatsApp on your phone (Settings → Linked Devices → Link a Device):\n");
    qrcodeTerminal.generate(qr, { small: true });
    try {
      const qrDataUrl = await QRCode.toDataURL(qr);
      await postJson(serverUrl, "/api/whatsapp/companion/state", { email, password, state: "qr", qrDataUrl });
    } catch (e) {
      console.error("Couldn't send QR to Cowork (you can still scan the one printed above):", e.message);
    }
  });

  client.on("ready", async () => {
    ready = true;
    console.log("\n✅ WhatsApp connected. Leave this running — Cowork will use it when it needs WhatsApp.\n");
    await postJson(serverUrl, "/api/whatsapp/companion/state", { email, password, state: "ready", qrDataUrl: null }).catch(() => {});
  });

  client.on("auth_failure", async (msg) => {
    console.error("\n❌ Authentication failed:", msg);
    await postJson(serverUrl, "/api/whatsapp/companion/state", { email, password, state: "auth_failure", error: msg || "Authentication failed." }).catch(() => {});
  });

  client.on("disconnected", async (reason) => {
    ready = false;
    console.log("\nWhatsApp disconnected:", reason);
    await postJson(serverUrl, "/api/whatsapp/companion/state", { email, password, state: "disconnected" }).catch(() => {});
  });

  async function runCommand(command) {
    if (!ready) throw new Error("WhatsApp isn't connected yet on this computer.");
    const chats = await client.getChats();
    if (command.type === "listChats") {
      const limit = command.args.limit || 20;
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
    const query = String(command.args.chatQuery || "").toLowerCase();
    const chat = chats.find((c) => c.name && c.name.toLowerCase().includes(query));
    if (!chat) return { error: `No WhatsApp chat found matching "${command.args.chatQuery}".` };

    if (command.type === "readMessages") {
      const limit = command.args.limit || 20;
      const messages = await chat.fetchMessages({ limit });
      return {
        chatName: chat.name,
        messages: messages.map((m) => ({ fromMe: m.fromMe, author: m.author, body: m.body, timestamp: m.timestamp })),
      };
    }
    if (command.type === "sendMessage") {
      await client.sendMessage(chat.id._serialized, command.args.text);
      return { sent: true, chatName: chat.name };
    }
    throw new Error(`Unknown command type: ${command.type}`);
  }

  async function pollLoop() {
    for (;;) {
      try {
        const { command } = await postJson(serverUrl, "/api/whatsapp/companion/poll", { email, password });
        if (command) {
          try {
            const result = await runCommand(command);
            await postJson(serverUrl, "/api/whatsapp/companion/result", { email, password, commandId: command.id, result });
          } catch (err) {
            await postJson(serverUrl, "/api/whatsapp/companion/result", { email, password, commandId: command.id, error: err.message }).catch(() => {});
          }
        }
      } catch (err) {
        console.error("Poll error (retrying in 5s):", err.message);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  console.log("Starting WhatsApp…");
  await client.initialize();
  pollLoop();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
