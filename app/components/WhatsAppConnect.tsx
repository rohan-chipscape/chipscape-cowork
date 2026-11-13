"use client";

import { useEffect, useRef, useState } from "react";

type Status = { state: "idle" | "qr" | "ready" | "auth_failure" | "disconnected"; qrDataUrl: string | null; error: string | null };

// Automates a real logged-in WhatsApp Web session, not an official WhatsApp
// integration — connecting is a one-time QR scan, same as pairing WhatsApp
// Web on a new computer. See lib/whatsapp/client.ts for the full context.
export function WhatsAppConnect({ onConnected }: { onConnected?: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/whatsapp/status")
      .then((r) => r.json())
      .then((s) => setStatus(s))
      .catch(() => {});
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function startConnect() {
    setOpen(true);
    // No server-side "connect" call anymore — the companion app running on
    // this account's own computer connects to WhatsApp on its own and pushes
    // its state here; we just poll for whatever it reports.
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/whatsapp/status");
        const s: Status = await res.json();
        setStatus(s);
        if (s.state === "ready") {
          stopPolling();
          onConnected?.();
          setTimeout(() => setOpen(false), 1200);
        }
      } catch {
        // keep polling — a transient network error shouldn't stop it
      }
    }, 2000);
  }

  useEffect(() => stopPolling, []);

  const connected = status?.state === "ready";

  return (
    <>
      <button
        onClick={() => (connected ? setOpen(true) : startConnect())}
        className="block w-full px-3 py-2.5 text-left text-sm text-neutral-200 hover:bg-white/10"
      >
        {connected ? "WhatsApp connected ✓" : "Connect WhatsApp"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex w-[320px] flex-col items-center gap-4 rounded-2xl bg-[#1f1f1f] p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {connected ? (
              <>
                <p className="text-lg font-medium text-emerald-400">WhatsApp connected</p>
                <p className="text-sm text-neutral-400">
                  The agent can now read and send WhatsApp messages for you (sending always asks for your
                  approval first).
                </p>
              </>
            ) : status?.state === "qr" && status.qrDataUrl ? (
              <>
                <p className="text-sm text-neutral-300">
                  Open WhatsApp on your phone → Settings → Linked Devices → Link a Device, then scan this code.
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={status.qrDataUrl} alt="WhatsApp QR code" className="h-56 w-56 rounded-lg bg-white p-2" />
              </>
            ) : status?.state === "auth_failure" ? (
              <>
                <p className="text-sm text-red-400">{status.error || "Couldn't connect WhatsApp."}</p>
                <button
                  onClick={startConnect}
                  className="rounded-lg bg-[#2c67c5] px-4 py-2 text-sm font-medium text-white hover:bg-[#245499]"
                >
                  Try again
                </button>
              </>
            ) : status?.state === "disconnected" || status?.state === "idle" ? (
              <>
                <p className="text-sm text-neutral-300">
                  WhatsApp runs through a small companion app on your own computer — not this server — so WhatsApp
                  trusts the connection the same way it trusts your phone.
                </p>
                <a
                  href="/whatsapp-companion.zip"
                  className="rounded-lg bg-[#2c67c5] px-4 py-2 text-sm font-medium text-white hover:bg-[#245499]"
                >
                  Download companion app
                </a>
                <p className="text-xs text-neutral-500">
                  Unzip it, then double-click &quot;Start WhatsApp Companion.command&quot;. Leave it running whenever
                  you want WhatsApp access here — a QR code will appear in its window to scan.
                </p>
              </>
            ) : (
              <>
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-600 border-t-white" />
                <p className="text-sm text-neutral-400">Checking for the companion app…</p>
              </>
            )}
            <button
              onClick={() => setOpen(false)}
              className="mt-1 text-xs text-neutral-500 hover:text-neutral-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
