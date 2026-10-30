"use client";

import { useState } from "react";
import { CopyIcon, CheckIcon } from "@/app/components/icons";

function legacyCopy(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleCopy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // Some browsers/embedded contexts restrict the async Clipboard API —
      // fall back to the older selection-based copy, which has a different
      // (usually more permissive) permission model.
      ok = legacyCopy(text);
    }

    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      setFailed(true);
      setTimeout(() => setFailed(false), 1500);
    }
  }

  return (
    <button
      onClick={handleCopy}
      title={copied ? "Copied!" : failed ? "Couldn't copy — select the text manually" : "Copy"}
      className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-white/10 hover:text-neutral-300"
    >
      {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
    </button>
  );
}
