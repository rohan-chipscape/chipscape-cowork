"use client";

import type { AgentTurn } from "@/lib/useAgentChat";
import { Markdown } from "@/app/components/Markdown";
import { CopyButton } from "@/app/components/CopyButton";
import { SIDE_EFFECT_TOOLS } from "@/lib/agent/types";

const TOOL_LABELS: Record<string, string> = {
  web_search: "Search the web",
  web_fetch: "Fetch a web page",
  run_js: "Run JavaScript",
  create_document: "Create a document",
  generate_image: "Generate an image",
  gmail_search: "Search Gmail",
  gmail_read: "Read a Gmail message",
  gmail_send: "Send an email",
  calendar_list_events: "List calendar events",
  calendar_create_event: "Create a calendar event",
  drive_search: "Search Google Drive",
  drive_read_file: "Read a Drive file",
};

const GOOGLE_TOOLS = new Set([
  "gmail_search",
  "gmail_read",
  "gmail_send",
  "calendar_list_events",
  "calendar_create_event",
  "drive_search",
  "drive_read_file",
]);

function prettyArgs(name: string, raw: string): string {
  try {
    const args = JSON.parse(raw);
    const prefix = GOOGLE_TOOLS.has(name) && args.account ? `(${args.account})\n` : "";

    switch (name) {
      case "web_search":
        return `“${args.query}”`;
      case "generate_image":
        return `“${args.prompt}”`;
      case "web_fetch":
        return args.url;
      case "run_js":
        return args.code;
      case "gmail_search":
      case "drive_search":
        return `${prefix}“${args.query}”`;
      case "gmail_read":
        return `${prefix}message ${args.message_id}`;
      case "gmail_send":
        return `${prefix}To: ${args.to}\nSubject: ${args.subject}\n\n${args.body}`;
      case "calendar_list_events":
        return `${prefix}${args.time_min} → ${args.time_max}`;
      case "calendar_create_event":
        return `${prefix}“${args.summary}”\n${args.start} → ${args.end}${
          args.attendees?.length ? `\nAttendees: ${args.attendees.join(", ")}` : ""
        }`;
      case "drive_read_file":
        return `${prefix}file ${args.file_id}`;
      default:
        return raw;
    }
  } catch {
    return raw;
  }
}

function safeParse(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function EmailPreview({
  account,
  to,
  subject,
  body,
}: {
  account?: string;
  to: string;
  subject: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#1f1f1f] p-3 text-sm">
      {account && (
        <p className="mb-2 text-xs text-neutral-500">From: {account}</p>
      )}
      <p className="text-neutral-200">
        <span className="text-neutral-500">To: </span>
        {to}
      </p>
      <p className="text-neutral-200">
        <span className="text-neutral-500">Subject: </span>
        {subject}
      </p>
      <div className="mt-2 whitespace-pre-wrap border-t border-white/10 pt-2 text-neutral-300">
        {body}
      </div>
    </div>
  );
}

function EventPreview({
  account,
  summary,
  start,
  end,
  description,
  attendees,
}: {
  account?: string;
  summary: string;
  start: string;
  end: string;
  description?: string;
  attendees?: string[];
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#1f1f1f] p-3 text-sm">
      {account && (
        <p className="mb-2 text-xs text-neutral-500">Calendar: {account}</p>
      )}
      <p className="font-medium text-neutral-100">{summary}</p>
      <p className="mt-1 text-neutral-400">
        {formatDateTime(start)} → {formatDateTime(end)}
      </p>
      {description && <p className="mt-2 text-neutral-300">{description}</p>}
      {attendees && attendees.length > 0 && (
        <p className="mt-2 text-xs text-neutral-500">
          Attendees: {attendees.join(", ")}
        </p>
      )}
    </div>
  );
}

function DocumentPreview({ filename, downloadUrl }: { filename: string; downloadUrl: string }) {
  return (
    <a
      href={downloadUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#1f1f1f] p-3 text-sm hover:bg-[#262626]"
    >
      <span className="text-xl">📄</span>
      <span className="flex-1 text-neutral-200">{filename}</span>
      <span className="text-xs text-[#5b9bff]">Download</span>
    </a>
  );
}

function ImagePreview({ filename, downloadUrl }: { filename: string; downloadUrl: string }) {
  return (
    <div className="relative inline-block max-w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={downloadUrl}
        alt={filename}
        className="max-h-96 rounded-2xl border border-white/10 object-contain"
      />
      <a
        href={downloadUrl}
        download={filename}
        title="Download"
        className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    </div>
  );
}

function ImageGeneratingStatus({ status }: { status: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-[#2f2f2f] px-4 py-3 text-sm text-neutral-400">
      {status === "error" ? (
        "Couldn't generate the image."
      ) : (
        <>
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-500 border-t-transparent" />
          Generating image…
        </>
      )}
    </div>
  );
}

function BusyStatus({ label, status, errorLabel }: { label: string; status: string; errorLabel: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-[#2f2f2f] px-4 py-3 text-sm text-neutral-400">
      {status === "error" ? (
        errorLabel
      ) : (
        <>
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-500 border-t-transparent" />
          {label}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-900/40 text-amber-300",
    approved: "bg-emerald-900/40 text-emerald-300",
    denied: "bg-red-900/40 text-red-300",
    done: "bg-emerald-900/40 text-emerald-300",
    error: "bg-red-900/40 text-red-300",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
        styles[status] ?? "bg-neutral-800 text-neutral-400"
      }`}
    >
      {status}
    </span>
  );
}

export function AgentTurnView({
  turn,
  onResolve,
}: {
  turn: AgentTurn;
  onResolve: (turnId: string, decisions: Record<string, boolean>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {turn.steps.map((step) => {
        const args = safeParse(step.args);

        if (step.name === "generate_image") {
          const result = step.result ? safeParse(step.result) : null;
          return result?.download_url ? (
            <ImagePreview
              key={step.id}
              filename={result.filename}
              downloadUrl={result.download_url}
            />
          ) : (
            <ImageGeneratingStatus key={step.id} status={step.status} />
          );
        }

        if (step.name === "web_search") {
          const result = step.result ? safeParse(step.result) : null;
          if (result?.error) {
            return (
              <div key={step.id} className="rounded-2xl bg-[#2f2f2f] px-4 py-3 text-sm text-red-300">
                {result.error}
              </div>
            );
          }
          // Once a search succeeds, its sources aren't shown separately —
          // the final answer already incorporates them, same as ChatGPT
          // only surfacing a "Searching the web…" indicator while it runs.
          if (result?.results || step.status === "done" || step.status === "approved") {
            return null;
          }
          return (
            <BusyStatus
              key={step.id}
              label="Searching the web…"
              errorLabel="Couldn't search the web."
              status={step.status}
            />
          );
        }

        if (step.name === "web_fetch") {
          const result = step.result ? safeParse(step.result) : null;
          if (result?.error) {
            return (
              <div key={step.id} className="rounded-2xl bg-[#2f2f2f] px-4 py-3 text-sm text-red-300">
                {result.error}
              </div>
            );
          }
          if (result?.text || step.status === "done" || step.status === "approved") {
            return null;
          }
          return (
            <BusyStatus
              key={step.id}
              label="Reading the page…"
              errorLabel="Couldn't read that page."
              status={step.status}
            />
          );
        }

        return (
        <div
          key={step.id}
          className={`rounded-2xl px-4 py-3 ${
            SIDE_EFFECT_TOOLS.has(step.name)
              ? "border border-red-900/50 bg-red-950/10"
              : "bg-[#2f2f2f]"
          }`}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-neutral-200">
              {SIDE_EFFECT_TOOLS.has(step.name) ? "⚠️ " : ""}
              {TOOL_LABELS[step.name] ?? step.name}
            </span>
            <StatusBadge status={step.status} />
          </div>
          {step.name === "gmail_send" && args ? (
            <EmailPreview
              account={args.account}
              to={args.to}
              subject={args.subject}
              body={args.body}
            />
          ) : step.name === "calendar_create_event" && args ? (
            <EventPreview
              account={args.account}
              summary={args.summary}
              start={args.start}
              end={args.end}
              description={args.description}
              attendees={args.attendees}
            />
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-neutral-400">
              {prettyArgs(step.name, step.args)}
            </pre>
          )}
          {step.name === "create_document" && step.result && safeParse(step.result)?.download_url ? (
            <div className="mt-2">
              <DocumentPreview
                filename={safeParse(step.result).filename}
                downloadUrl={safeParse(step.result).download_url}
              />
            </div>
          ) : (
            step.result && (
              <p className="mt-2 whitespace-pre-wrap break-words text-xs text-neutral-500">
                {step.result}
              </p>
            )
          )}
        </div>
        );
      })}

      {turn.pendingCalls && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3">
          <p className="text-sm text-amber-200">
            The agent wants to run the action(s) above. Approve before it
            proceeds.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() =>
                onResolve(
                  turn.id,
                  Object.fromEntries(turn.pendingCalls!.map((c) => [c.id, true]))
                )
              }
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
            >
              Approve
            </button>
            <button
              onClick={() =>
                onResolve(
                  turn.id,
                  Object.fromEntries(turn.pendingCalls!.map((c) => [c.id, false]))
                )
              }
              className="rounded-lg bg-[#2f2f2f] px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-[#3a3a3a]"
            >
              Deny
            </button>
          </div>
        </div>
      )}

      {turn.error && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {turn.error}
        </div>
      )}

      {turn.finalText && (
        <div className="flex flex-col gap-1.5">
          {turn.steps.some(
            (s) =>
              (s.name === "web_search" || s.name === "web_fetch") &&
              !safeParse(s.result ?? "")?.error
          ) && <p className="px-1 text-xs text-neutral-500">🔍 Searched the web</p>}
          <div className="px-1 text-neutral-100">
            <Markdown text={turn.finalText} />
          </div>
          <div className="px-1">
            <CopyButton text={turn.finalText} />
          </div>
        </div>
      )}

      {!turn.done && !turn.pendingCalls && !turn.finalText && !turn.error && (
        <p className="px-1 text-sm text-neutral-500">Working…</p>
      )}
    </div>
  );
}
