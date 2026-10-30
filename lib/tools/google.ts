import { google } from "googleapis";
import { getAuthorizedClient } from "@/lib/google/client";

function toolError(err: unknown) {
  return { error: err instanceof Error ? err.message : String(err) };
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

function extractPlainText(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const text = extractPlainText(part);
    if (text) return text;
  }
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}

export async function gmailSearch(account: string, query: string, maxResults = 5) {
  try {
    const auth = getAuthorizedClient(account);
    const gmail = google.gmail({ version: "v1", auth });
    const list = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
    });

    const messages = await Promise.all(
      (list.data.messages ?? []).map(async (m) => {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: m.id!,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "Date"],
        });
        const headers = msg.data.payload?.headers ?? [];
        const get = (name: string) =>
          headers.find((h) => h.name === name)?.value ?? "";
        return {
          id: m.id,
          subject: get("Subject"),
          from: get("From"),
          date: get("Date"),
          snippet: msg.data.snippet,
        };
      })
    );

    return { account, messages };
  } catch (err) {
    return toolError(err);
  }
}

export async function gmailRead(account: string, messageId: string) {
  try {
    const auth = getAuthorizedClient(account);
    const gmail = google.gmail({ version: "v1", auth });
    const msg = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });
    const headers = msg.data.payload?.headers ?? [];
    const get = (name: string) =>
      headers.find((h) => h.name === name)?.value ?? "";
    const body = extractPlainText(msg.data.payload).slice(0, 6000);
    return {
      account,
      subject: get("Subject"),
      from: get("From"),
      to: get("To"),
      date: get("Date"),
      body,
    };
  } catch (err) {
    return toolError(err);
  }
}

export async function gmailSend(
  account: string,
  to: string,
  subject: string,
  body: string
) {
  try {
    const auth = getAuthorizedClient(account);
    const gmail = google.gmail({ version: "v1", auth });
    const raw = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      body,
    ].join("\r\n");
    const encoded = Buffer.from(raw).toString("base64url");
    await gmail.users.messages.send({ userId: "me", requestBody: { raw: encoded } });
    return { sent: true, account, to, subject };
  } catch (err) {
    return toolError(err);
  }
}

export async function calendarListEvents(
  account: string,
  timeMin: string,
  timeMax: string
) {
  try {
    const auth = getAuthorizedClient(account);
    const calendar = google.calendar({ version: "v3", auth });
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 20,
    });
    const events = (res.data.items ?? []).map((e) => ({
      id: e.id,
      summary: e.summary,
      start: e.start?.dateTime ?? e.start?.date,
      end: e.end?.dateTime ?? e.end?.date,
      attendees: e.attendees?.map((a) => a.email),
    }));
    return { account, events };
  } catch (err) {
    return toolError(err);
  }
}

export async function calendarCreateEvent(args: {
  account: string;
  summary: string;
  start: string;
  end: string;
  description?: string;
  attendees?: string[];
}) {
  try {
    const auth = getAuthorizedClient(args.account);
    const calendar = google.calendar({ version: "v3", auth });
    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: args.summary,
        description: args.description,
        start: { dateTime: args.start },
        end: { dateTime: args.end },
        attendees: args.attendees?.map((email) => ({ email })),
      },
    });
    return { account: args.account, created: true, id: res.data.id, link: res.data.htmlLink };
  } catch (err) {
    return toolError(err);
  }
}

export async function driveSearch(account: string, query: string) {
  try {
    const auth = getAuthorizedClient(account);
    const drive = google.drive({ version: "v3", auth });
    const res = await drive.files.list({
      q: `fullText contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
      fields: "files(id, name, mimeType, webViewLink, modifiedTime)",
      pageSize: 10,
    });
    return { account, files: res.data.files ?? [] };
  } catch (err) {
    return toolError(err);
  }
}

export async function driveReadFile(account: string, fileId: string) {
  try {
    const auth = getAuthorizedClient(account);
    const drive = google.drive({ version: "v3", auth });
    const meta = await drive.files.get({ fileId, fields: "mimeType, name" });
    const mimeType = meta.data.mimeType ?? "";

    if (mimeType === "application/vnd.google-apps.document") {
      const res = await drive.files.export(
        { fileId, mimeType: "text/plain" },
        { responseType: "text" }
      );
      return { account, name: meta.data.name, text: String(res.data).slice(0, 8000) };
    }
    if (mimeType === "application/vnd.google-apps.spreadsheet") {
      const res = await drive.files.export(
        { fileId, mimeType: "text/csv" },
        { responseType: "text" }
      );
      return { account, name: meta.data.name, text: String(res.data).slice(0, 8000) };
    }
    if (mimeType.startsWith("text/")) {
      const res = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "text" }
      );
      return { account, name: meta.data.name, text: String(res.data).slice(0, 8000) };
    }
    return {
      account,
      name: meta.data.name,
      error: `Reading files of type ${mimeType} isn't supported yet.`,
    };
  } catch (err) {
    return toolError(err);
  }
}
