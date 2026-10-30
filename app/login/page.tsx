"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      try {
        localStorage.setItem("cowork_user_name", name.trim());
      } catch {
        // localStorage unavailable (private mode, etc.) — not critical
      }
      router.push("/");
      router.refresh();
    } else {
      setError("Incorrect password.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#000000] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-[#000000] p-8 shadow-xl"
      >
        <h1 className="mb-1 text-xl font-semibold text-neutral-100">
          Chipscape Cowork
        </h1>
        <p className="mb-6 text-sm text-neutral-400">
          Multi-model panel assistant
        </p>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="mb-3 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-neutral-100 outline-none focus:border-neutral-500"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Access password"
          className="mb-3 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-neutral-100 outline-none focus:border-neutral-500"
        />
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white transition hover:bg-emerald-500 disabled:opacity-60"
        >
          {loading ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
