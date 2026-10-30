"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/app/components/icons";

export function ConnectedAccounts({ configured }: { configured: boolean }) {
  const [accounts, setAccounts] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = () => {
    fetch("/api/auth/google/accounts")
      .then((r) => r.json())
      .then((data) => setAccounts(data.accounts ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    if (configured) refresh();
  }, [configured]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function disconnect(email: string) {
    await fetch("/api/auth/google/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    refresh();
  }

  if (!configured) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`rounded-full px-3 py-1 text-xs font-medium ${
          accounts.length > 0
            ? "bg-emerald-900/40 text-emerald-300"
            : "bg-[#2f2f2f] text-neutral-300 hover:bg-[#3a3a3a]"
        }`}
      >
        {accounts.length === 0
          ? "Connect Google"
          : accounts.length === 1
          ? "Google connected"
          : `${accounts.length} Google accounts`}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-2 w-72 rounded-xl bg-[#2f2f2f] p-2 shadow-xl">
          <p className="px-2 py-1 text-xs font-medium text-neutral-500">
            Connected accounts
          </p>
          {accounts.length === 0 && (
            <p className="px-2 py-2 text-xs text-neutral-500">None yet</p>
          )}
          {accounts.map((email) => (
            <div
              key={email}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm text-neutral-200 hover:bg-white/5"
            >
              <span className="min-w-0 truncate">{email}</span>
              <button
                onClick={() => disconnect(email)}
                title="Disconnect"
                className="shrink-0 text-neutral-500 hover:text-red-400"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <a
            href="/api/auth/google/start"
            className="mt-1 block rounded-lg px-2 py-2 text-sm text-emerald-400 hover:bg-white/5"
          >
            + Connect another account
          </a>
        </div>
      )}
    </div>
  );
}
