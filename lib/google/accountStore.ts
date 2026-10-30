import fs from "node:fs";
import path from "node:path";

// One file per connected Google account, keyed by email — lets the CEO
// connect several accounts (e.g. company + personal Gmail) at once. Mount
// `.data/` as a volume in production so this survives container restarts.
const DIR = path.join(process.cwd(), ".data", "google-accounts");

export type StoredTokens = {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  scope?: string;
};

function ensureDir() {
  fs.mkdirSync(DIR, { recursive: true });
}

function filePath(email: string) {
  // emails are safe-ish but slashes etc. could appear in edge cases — encode defensively.
  return path.join(DIR, `${encodeURIComponent(email)}.json`);
}

export function listConnectedAccounts(): string[] {
  ensureDir();
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => decodeURIComponent(f.slice(0, -".json".length)));
}

export function getAccountTokens(email: string): StoredTokens | null {
  try {
    const raw = fs.readFileSync(filePath(email), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAccountTokens(email: string, tokens: StoredTokens) {
  ensureDir();
  fs.writeFileSync(filePath(email), JSON.stringify(tokens, null, 2));
}

export function removeAccount(email: string) {
  try {
    fs.unlinkSync(filePath(email));
  } catch {
    // already gone
  }
}

export function isGoogleConnected(): boolean {
  return listConnectedAccounts().length > 0;
}
