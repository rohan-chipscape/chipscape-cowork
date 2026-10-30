import { google } from "googleapis";
import { getAccountTokens, saveAccountTokens } from "./accountStore";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth isn't configured — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI."
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** An OAuth2 client pre-loaded with one account's stored tokens, auto-persisting refreshes. */
export function getAuthorizedClient(email: string) {
  const tokens = getAccountTokens(email);
  if (!tokens?.refresh_token) {
    throw new Error(
      `"${email}" isn't connected — connect it from the app first.`
    );
  }

  const client = getOAuthClient();
  client.setCredentials(tokens);
  client.on("tokens", (newTokens) => {
    saveAccountTokens(email, { ...tokens, ...newTokens });
  });

  return client;
}

/** Looks up the email address that owns a freshly-issued set of tokens. */
export async function getEmailForTokens(tokens: {
  access_token?: string | null;
}): Promise<string> {
  const client = getOAuthClient();
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  if (!data.email) throw new Error("Google didn't return an email address for this account.");
  return data.email;
}
