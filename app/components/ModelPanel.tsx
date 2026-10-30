"use client";

import { useState } from "react";
import type { ModelPanelEntry } from "@/lib/useDebateChat";
import { Markdown } from "@/app/components/Markdown";

function StatusDot({ status }: { status: ModelPanelEntry["status"] }) {
  const color =
    status === "thinking"
      ? "bg-amber-400 animate-pulse"
      : status === "done"
      ? "bg-emerald-400"
      : "bg-red-400";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

export function ModelPanel({
  panel,
  synthesizing,
}: {
  panel: ModelPanelEntry[];
  synthesizing: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (panel.length === 0) return null;

  const allDone = panel.every((p) => p.status !== "thinking");
  const label = allDone
    ? synthesizing
      ? "Panel answered — synthesizing best answer…"
      : "Panel answered"
    : "Panel is debating…";

  return (
    <div className="mb-3 rounded-2xl bg-[#2f2f2f]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm text-neutral-300"
      >
        <div className="flex items-center gap-2">
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1">
            {panel.map((p) => (
              <span
                key={p.id}
                title={p.label}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-[#2f2f2f] bg-[#454545] text-[10px] font-medium text-neutral-300"
              >
                {p.label[0]}
              </span>
            ))}
          </div>
          <span className="text-neutral-500">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="space-y-2 border-t border-white/10 px-4 py-3">
          {panel.map((p) => (
            <div key={p.id} className="rounded-xl bg-[#000000] p-3">
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-neutral-400">
                <StatusDot status={p.status} />
                <span>{p.label}</span>
                {p.latencyMs !== undefined && (
                  <span className="text-neutral-600">
                    · {(p.latencyMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              {p.status === "thinking" && (
                <p className="text-xs text-neutral-500">Thinking…</p>
              )}
              {p.status === "error" && (
                <p className="text-xs text-red-400">{p.error}</p>
              )}
              {p.status === "done" && (
                <Markdown text={p.text} className="text-xs text-neutral-400" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
