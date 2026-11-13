// The server never runs WhatsApp's browser itself anymore (see client.ts for
// why: WhatsApp's own anti-abuse system silently rejects pairing from
// datacenter IPs, which is what every VPS is). Instead, a companion app the
// account owner runs on their own computer does the actual WhatsApp Web
// automation over their own normal internet connection, and talks to this
// server purely to relay commands and status — this module is that relay.

type ConnectionState = "idle" | "qr" | "ready" | "auth_failure" | "disconnected";

type CompanionState = {
  state: ConnectionState;
  qrDataUrl: string | null;
  error: string | null;
  lastSeen: number;
};

type PendingCommand = {
  id: string;
  type: "listChats" | "readMessages" | "sendMessage";
  args: Record<string, unknown>;
};

type WaitingCommand = PendingCommand & {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
};

const companionStates = new Map<string, CompanionState>();
const pendingQueues = new Map<string, PendingCommand[]>();
const waitingCommands = new Map<string, WaitingCommand>();
// Resolvers for a companion's long-poll GET that's currently waiting for a
// command to show up in its queue, so enqueueing can wake it immediately
// instead of waiting out the rest of the poll's timeout.
const pollWakers = new Map<string, () => void>();

const COMPANION_STALE_MS = 30_000; // no poll in this long = treat as disconnected
const COMMAND_TIMEOUT_MS = 25_000;
const LONG_POLL_MS = 20_000;

function freshId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isCompanionOnline(email: string): boolean {
  const s = companionStates.get(email);
  return !!s && Date.now() - s.lastSeen < COMPANION_STALE_MS;
}

export function getStatus(email: string): { state: ConnectionState; qrDataUrl: string | null; error: string | null } {
  const s = companionStates.get(email);
  if (!s) return { state: "idle", qrDataUrl: null, error: null };
  if (!isCompanionOnline(email) && s.state !== "idle") {
    return { state: "disconnected", qrDataUrl: null, error: "The WhatsApp companion app isn't running on your computer." };
  }
  return { state: s.state, qrDataUrl: s.qrDataUrl, error: s.error };
}

// Called by the companion app to push its own connection state up.
export function reportState(email: string, state: ConnectionState, qrDataUrl: string | null, error: string | null): void {
  companionStates.set(email, { state, qrDataUrl, error, lastSeen: Date.now() });
}

// Called by the companion app's long-poll loop.
export function touchPresence(email: string): void {
  const existing = companionStates.get(email);
  if (existing) existing.lastSeen = Date.now();
  else companionStates.set(email, { state: "idle", qrDataUrl: null, error: null, lastSeen: Date.now() });
}

export async function waitForCommand(email: string): Promise<PendingCommand | null> {
  const queue = pendingQueues.get(email) ?? [];
  const next = queue.shift();
  if (next) {
    pendingQueues.set(email, queue);
    return next;
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pollWakers.delete(email);
      resolve(null);
    }, LONG_POLL_MS);
    pollWakers.set(email, () => {
      clearTimeout(timer);
      pollWakers.delete(email);
      const q = pendingQueues.get(email) ?? [];
      resolve(q.shift() ?? null);
      pendingQueues.set(email, q);
    });
  });
}

export function submitResult(commandId: string, result: unknown, error: string | null): void {
  const waiting = waitingCommands.get(commandId);
  if (!waiting) return;
  clearTimeout(waiting.timeout);
  waitingCommands.delete(commandId);
  if (error) waiting.reject(new Error(error));
  else waiting.resolve(result);
}

export async function sendCommand(
  email: string,
  type: PendingCommand["type"],
  args: Record<string, unknown>
): Promise<unknown> {
  if (!isCompanionOnline(email)) {
    throw new Error("The WhatsApp companion app isn't running on your computer. Open it to use WhatsApp here.");
  }
  const command: PendingCommand = { id: freshId(), type, args };
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      waitingCommands.delete(command.id);
      reject(new Error("WhatsApp companion app didn't respond in time."));
    }, COMMAND_TIMEOUT_MS);
    waitingCommands.set(command.id, { ...command, resolve, reject, timeout });

    const queue = pendingQueues.get(email) ?? [];
    queue.push(command);
    pendingQueues.set(email, queue);

    const waker = pollWakers.get(email);
    if (waker) waker();
  });
}
