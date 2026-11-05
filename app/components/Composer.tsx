"use client";

import { RefObject, useEffect, useRef } from "react";
import { AttachIcon, SendIcon, CloseIcon, MicIcon, StopIcon } from "@/app/components/icons";
import { useSpeechInput } from "@/lib/speech/useSpeechInput";

export type Attachment = { name: string; text: string };

export function Composer({
  input,
  onInputChange,
  onSubmit,
  isBusy,
  attachment,
  onRemoveAttachment,
  uploading,
  uploadError,
  fileInputRef,
  onFileSelected,
  onFilePasted,
}: {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isBusy: boolean;
  attachment: Attachment | null;
  onRemoveAttachment: () => void;
  uploading: boolean;
  uploadError: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFilePasted: (file: File) => void;
}) {
  const speech = useSpeechInput(onInputChange);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Textarea doesn't grow on its own as you type/paste — without this, long
  // prompts stay clipped to one line instead of expanding like ChatGPT's.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-3xl flex-col gap-2">
      {(attachment || uploading || uploadError || speech.error || speech.transcribing) && (
        <div className="flex items-center gap-2 text-xs">
          {uploading && <span className="text-neutral-500">Reading file…</span>}
          {uploadError && <span className="text-red-400">{uploadError}</span>}
          {speech.transcribing && (
            <span className="text-neutral-500">Transcribing…</span>
          )}
          {speech.error && <span className="text-red-400">{speech.error}</span>}
          {attachment && !uploading && (
            <span className="flex items-center gap-2 rounded-full bg-[#2f2f2f] px-3 py-1 text-neutral-300">
              📎 {attachment.name}
              <button
                type="button"
                onClick={onRemoveAttachment}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}
      <div className="flex items-end gap-1.5 rounded-[28px] bg-[#2f2f2f] px-2 py-1.5 shadow-lg">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.json,.jpg,.jpeg,.png,.webp"
          onChange={onFileSelected}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy || uploading}
          title="Attach a file"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-300 hover:bg-white/10 disabled:opacity-50"
        >
          <AttachIcon className="h-5 w-5" />
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e as unknown as React.FormEvent);
            }
          }}
          onPaste={(e) => {
            // A copied file (from Finder/Explorer) or a copied/screenshotted
            // image shows up as a "file" item here — attach it the same way
            // the picker does, instead of letting the browser try to paste
            // it as text. Falls through to normal text paste otherwise.
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
              if (item.kind === "file") {
                const file = item.getAsFile();
                if (file) {
                  e.preventDefault();
                  onFilePasted(file);
                  return;
                }
              }
            }
          }}
          rows={1}
          placeholder={
            speech.recording ? "Listening…" : "Ask anything, or ask it to do something…"
          }
          className="max-h-64 flex-1 resize-none overflow-y-auto bg-transparent py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-500"
        />
        <button
          type="button"
          onClick={speech.toggle}
          disabled={isBusy || speech.transcribing}
          title={speech.recording ? "Stop recording" : "Speak instead of typing"}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:opacity-50 ${
            speech.recording
              ? "bg-red-600 text-white hover:bg-red-500"
              : "text-neutral-300 hover:bg-white/10"
          }`}
        >
          {speech.recording ? (
            <StopIcon className="h-4 w-4" />
          ) : (
            <MicIcon className="h-5 w-5" />
          )}
        </button>
        <button
          type="submit"
          disabled={isBusy || (!input.trim() && !attachment)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2c67c5] text-white transition hover:bg-[#245499] disabled:bg-neutral-600 disabled:text-neutral-400"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
