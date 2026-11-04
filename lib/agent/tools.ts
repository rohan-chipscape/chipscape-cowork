import type OpenAI from "openai";
import { webSearch } from "@/lib/tools/webSearch";
import { webFetch } from "@/lib/tools/webFetch";
import { runJs } from "@/lib/tools/runJs";
import {
  gmailSearch,
  gmailRead,
  gmailSend,
  calendarListEvents,
  calendarCreateEvent,
  driveSearch,
  driveReadFile,
} from "@/lib/tools/google";
import { getAccountTokens } from "@/lib/google/accountStore";
import { buildMemoryBlock } from "@/lib/memory/context";
import { createPdfDocument } from "@/lib/files/generateDocument";
import { generateImage } from "@/lib/files/generateImage";

const BASE_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for up-to-date information. Returns a short list of results with title, url, and snippet.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_fetch",
      description: "Fetch a specific web page by URL and return its readable text content.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_js",
      description:
        "Run a short JavaScript snippet in a sandbox (no filesystem or network access) for calculations or data processing. Use console.log to print results.",
      parameters: {
        type: "object",
        properties: { code: { type: "string" } },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_document",
      description:
        "Create a downloadable PDF document — use this whenever the user asks you to write, generate, " +
        "draft, or give them a document, report, memo, or PDF, instead of just replying with the content " +
        "as a chat message. Supports simple formatting in `content`: lines starting with '# ' or '## ' " +
        "become headings, and lines starting with '- ' become bullet points.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short document title, also used as the filename." },
          content: { type: "string", description: "The full body of the document." },
        },
        required: ["title", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description:
        "Generate an image from a text description — use this whenever the user asks you to generate, " +
        "create, draw, or make an image, picture, logo, or illustration. Returns a downloadable PNG.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "A detailed description of the image to generate." },
          title: { type: "string", description: "Short title, used as the filename (optional)." },
        },
        required: ["prompt"],
      },
    },
  },
];

// Google tools never take an "account" argument from the model — they always
// act on whichever Google account this session signed in with (see
// lib/auth/session.ts), the same way ChatGPT's connectors are scoped to
// whoever is currently signed in, not a shared pool of every account anyone
// has ever connected.
const GOOGLE_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "gmail_search",
      description: "Search the signed-in user's Gmail inbox. Returns matching messages' id, subject, from, date, and snippet.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Gmail search syntax, e.g. 'from:boss@company.com is:unread'.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gmail_read",
      description: "Read the full content of one Gmail message by its id (from gmail_search).",
      parameters: {
        type: "object",
        properties: { message_id: { type: "string" } },
        required: ["message_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gmail_send",
      description: "Send an email from the signed-in user's Gmail account. Always requires explicit approval.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calendar_list_events",
      description: "List events on the signed-in user's Google Calendar between two ISO datetimes.",
      parameters: {
        type: "object",
        properties: {
          time_min: { type: "string", description: "ISO datetime, e.g. 2026-10-22T00:00:00Z" },
          time_max: { type: "string", description: "ISO datetime" },
        },
        required: ["time_min", "time_max"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calendar_create_event",
      description: "Create an event on the signed-in user's Google Calendar. Always requires explicit approval.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
          start: { type: "string", description: "ISO datetime" },
          end: { type: "string", description: "ISO datetime" },
          description: { type: "string" },
          attendees: { type: "array", items: { type: "string" }, description: "Attendee email addresses" },
        },
        required: ["summary", "start", "end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "drive_search",
      description: "Search the signed-in user's Google Drive for files matching text. Returns id, name, mimeType, link.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "drive_read_file",
      description: "Read the text content of a Google Drive file (Docs, Sheets, or plain text) by its id (from drive_search).",
      parameters: {
        type: "object",
        properties: { file_id: { type: "string" } },
        required: ["file_id"],
      },
    },
  },
];

const GOOGLE_TOOL_NAMES = new Set([
  "gmail_search",
  "gmail_read",
  "gmail_send",
  "calendar_list_events",
  "calendar_create_event",
  "drive_search",
  "drive_read_file",
]);

/** Is this session's Google account actually connected (has a refresh token)? */
function isSessionAccountConnected(sessionEmail: string | null): boolean {
  if (!sessionEmail) return false;
  return !!getAccountTokens(sessionEmail)?.refresh_token;
}

export function getAgentTools(sessionEmail: string | null): OpenAI.Chat.ChatCompletionTool[] {
  return isSessionAccountConnected(sessionEmail) ? [...BASE_TOOLS, ...GOOGLE_TOOLS] : BASE_TOOLS;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  sessionEmail: string | null
) {
  if (GOOGLE_TOOL_NAMES.has(name)) {
    if (!sessionEmail) return { error: "No Google account is connected for this session." };
    switch (name) {
      case "gmail_search":
        return gmailSearch(sessionEmail, String(args.query ?? ""));
      case "gmail_read":
        return gmailRead(sessionEmail, String(args.message_id ?? ""));
      case "gmail_send":
        return gmailSend(
          sessionEmail,
          String(args.to ?? ""),
          String(args.subject ?? ""),
          String(args.body ?? "")
        );
      case "calendar_list_events":
        return calendarListEvents(sessionEmail, String(args.time_min ?? ""), String(args.time_max ?? ""));
      case "calendar_create_event":
        return calendarCreateEvent({
          account: sessionEmail,
          summary: String(args.summary ?? ""),
          start: String(args.start ?? ""),
          end: String(args.end ?? ""),
          description: args.description ? String(args.description) : undefined,
          attendees: Array.isArray(args.attendees) ? args.attendees.map(String) : undefined,
        });
      case "drive_search":
        return driveSearch(sessionEmail, String(args.query ?? ""));
      case "drive_read_file":
        return driveReadFile(sessionEmail, String(args.file_id ?? ""));
    }
  }

  switch (name) {
    case "web_search":
      return webSearch(String(args.query ?? ""));
    case "web_fetch":
      return webFetch(String(args.url ?? ""));
    case "run_js":
      return runJs(String(args.code ?? ""));
    case "create_document": {
      const title = String(args.title ?? "Document");
      const { id, filename } = await createPdfDocument(title, String(args.content ?? ""));
      return {
        id,
        filename,
        download_url: `/api/files/download/${id}/${encodeURIComponent(filename)}`,
      };
    }
    case "generate_image": {
      const { id, filename } = await generateImage(
        String(args.prompt ?? ""),
        args.title ? String(args.title) : undefined
      );
      return {
        id,
        filename,
        download_url: `/api/files/download/${id}/${encodeURIComponent(filename)}`,
      };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export function getAgentSystemPrompt(sessionEmail: string | null): string {
  const accountsNote = isSessionAccountConnected(sessionEmail)
    ? `Gmail/Calendar/Drive tools are available for the signed-in account (${sessionEmail}).`
    : "Gmail/Calendar/Drive tools aren't available — this account isn't connected to Google.";

  return (
    "You are an agentic assistant working directly for a CEO. You can call tools to search the web, " +
    "fetch specific pages, run short JavaScript calculations, create a downloadable PDF document, generate " +
    "an image from a text description, and — " +
    `when connected — search/read/send Gmail, list/create Google Calendar events, and search/read Google ` +
    `Drive files. ${accountsNote} ` +
    "Sending an email or creating a calendar event is shown to the CEO for approval before it runs; every " +
    "other tool (search, fetch, document/image generation, reading Gmail/Calendar/Drive) runs immediately " +
    "and you'll see its result right away. Use tools only when they're actually needed to answer accurately " +
    "or complete the task — for a question you can answer directly from your own knowledge, just answer " +
    "directly without calling a tool. When a question needs a specific, current fact or number (a price, a " +
    "score, a statistic, today's data), don't settle for a vague search snippet — use web_fetch on the most " +
    "relevant result to pull the exact figure before answering, and if the first search doesn't nail it down, " +
    "search again with a more specific query rather than giving the CEO a hedge or a list of options. If the " +
    "CEO asks you to write, draft, or give them a document, report, memo, or PDF, always use create_document " +
    "rather than just putting the content in a chat reply. If the CEO asks you to generate, create, draw, or " +
    "make an image, logo, or picture, always use generate_image rather than describing what the image would " +
    "look like in text. Be concise, direct, and decision-useful. When you're done, give one clear final answer." +
    buildMemoryBlock()
  );
}
