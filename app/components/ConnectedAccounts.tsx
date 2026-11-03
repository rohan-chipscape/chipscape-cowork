"use client";

import { useEffect, useState } from "react";

// Shows the single Google account this session is signed in with — not a
// list to manage. Switching accounts means logging out and signing back in
// with a different Google account, the same way ChatGPT connectors work.
export function ConnectedAccounts({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    fetch("/api/auth/google/status")
      .then((r) => r.json())
      .then((data) => setEmail(data.connected ? data.email : null))
      .catch(() => {});
  }, [configured]);

  if (!configured || !email) return null;

  return (
    <span
      title={`Signed in with ${email}`}
      className="rounded-full bg-emerald-900/40 px-3 py-1 text-xs font-medium text-emerald-300"
    >
      Google connected
    </span>
  );
}
