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
import { listConnectedAccounts } from "@/lib/google/accountStore";
import { buildMemoryBlock } from "@/lib/memory/context";

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
];

function buildGoogleTools(accounts: string[]): OpenAI.Chat.ChatCompletionTool[] {
  const accountProp = {
    type: "string" as const,
    enum: accounts,
    description:
      "Which connected Google account to use. If the user didn't specify and more than one " +
      "account is connected, ask them which one before calling this tool.",
  };

  return [
    {
      type: "function",
      function: {
        name: "gmail_search",
        description: "Search a connected Gmail inbox. Returns matching messages' id, subject, from, date, and snippet.",
        parameters: {
          type: "object",
          properties: {
            account: accountProp,
            query: {
              type: "string",
              description: "Gmail search syntax, e.g. 'from:boss@company.com is:unread'.",
            },
          },
          required: ["account", "query"],
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
          properties: {
            account: accountProp,
            message_id: { type: "string" },
          },
          required: ["account", "message_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "gmail_send",
        description: "Send an email from a connected Gmail account. Always requires explicit approval.",
        parameters: {
          type: "object",
          properties: {
            account: accountProp,
            to: { type: "string" },
            subject: { type: "string" },
            body: { type: "string" },
          },
          required: ["account", "to", "subject", "body"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "calendar_list_events",
        description: "List events on a connected Google Calendar between two ISO datetimes.",
        parameters: {
          type: "object",
          properties: {
            account: accountProp,
            time_min: { type: "string", description: "ISO datetime, e.g. 2026-10-22T00:00:00Z" },
            time_max: { type: "string", description: "ISO datetime" },
          },
          required: ["account", "time_min", "time_max"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "calendar_create_event",
        description: "Create an event on a connected Google Calendar. Always requires explicit approval.",
        parameters: {
          type: "object",
          properties: {
            account: accountProp,
            summary: { type: "string" },
            start: { type: "string", description: "ISO datetime" },
            end: { type: "string", description: "ISO datetime" },
            description: { type: "string" },
            attendees: { type: "array", items: { type: "string" }, description: "Attendee email addresses" },
          },
          required: ["account", "summary", "start", "end"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "drive_search",
        description: "Search a connected Google Drive for files matching text. Returns id, name, mimeType, link.",
        parameters: {
          type: "object",
          properties: {
            account: accountProp,
            query: { type: "string" },
          },
          required: ["account", "query"],
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
          properties: {
            account: accountProp,
            file_id: { type: "string" },
          },
          required: ["account", "file_id"],
        },
      },
    },
  ];
}

export function getAgentTools(): OpenAI.Chat.ChatCompletionTool[] {
  const accounts = listConnectedAccounts();
  return accounts.length > 0 ? [...BASE_TOOLS, ...buildGoogleTools(accounts)] : BASE_TOOLS;
}

export async function executeTool(name: string, args: Record<string, unknown>) {
  const account = String(args.account ?? "");
  switch (name) {
    case "web_search":
      return webSearch(String(args.query ?? ""));
    case "web_fetch":
      return webFetch(String(args.url ?? ""));
    case "run_js":
      return runJs(String(args.code ?? ""));
    case "gmail_search":
      return gmailSearch(account, String(args.query ?? ""));
    case "gmail_read":
      return gmailRead(account, String(args.message_id ?? ""));
    case "gmail_send":
      return gmailSend(
        account,
        String(args.to ?? ""),
        String(args.subject ?? ""),
        String(args.body ?? "")
      );
    case "calendar_list_events":
      return calendarListEvents(account, String(args.time_min ?? ""), String(args.time_max ?? ""));
    case "calendar_create_event":
      return calendarCreateEvent({
        account,
        summary: String(args.summary ?? ""),
        start: String(args.start ?? ""),
        end: String(args.end ?? ""),
        description: args.description ? String(args.description) : undefined,
        attendees: Array.isArray(args.attendees) ? args.attendees.map(String) : undefined,
      });
    case "drive_search":
      return driveSearch(account, String(args.query ?? ""));
    case "drive_read_file":
      return driveReadFile(account, String(args.file_id ?? ""));
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export function getAgentSystemPrompt(): string {
  const accounts = listConnectedAccounts();
  const accountsNote =
    accounts.length === 0
      ? "No Google accounts are connected yet, so Gmail/Calendar/Drive tools aren't available."
      : accounts.length === 1
      ? `The Google account "${accounts[0]}" is connected and available for Gmail/Calendar/Drive tools.`
      : `These Google accounts are connected: ${accounts.join(", ")}. If the user's request doesn't make ` +
        "it clear which account to use, ask them which one before calling any Gmail/Calendar/Drive tool — " +
        "never guess.";

  return (
    "You are an agentic assistant working directly for a CEO. You can call tools to search the web, " +
    "fetch specific pages, run short JavaScript calculations, and — when connected — search/read/send " +
    `Gmail, list/create Google Calendar events, and search/read Google Drive files. ${accountsNote} ` +
    "Every tool call is shown to the CEO for approval before it runs, and you will see the result (or a " +
    "note that it was denied) afterward. Use tools only when they're actually needed to answer accurately " +
    "or complete the task — for a question you can answer directly from your own knowledge, just answer " +
    "directly without calling a tool. Be concise, direct, and decision-useful. When you're done, give one " +
    "clear final answer." +
    buildMemoryBlock()
  );
}
