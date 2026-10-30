"use client";

import { useCallback, useRef, useState } from "react";

// Minimal shape of the Web Speech API — not in lib.dom.d.ts.
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

export function useSpeechInput(onTranscript: (text: string) => void) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startFallbackRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setRecording(false);
        setTranscribing(true);
        setError("");
        try {
          const audioBlob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          const form = new FormData();
          form.append("file", audioBlob, "voice.webm");
          const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Transcription failed");
          if (data.text) onTranscript(data.text);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone access denied.");
      setRecording(false);
    }
  }, [onTranscript]);

  const start = useCallback(() => {
    setError("");
    const Ctor = getSpeechRecognitionCtor();

    if (Ctor) {
      try {
        const recognition = new Ctor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        let finalTranscript = "";
        let gotAnyResult = false;

        recognition.onresult = (event) => {
          gotAnyResult = true;
          let interimTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const piece = result[0].transcript;
            if (result.isFinal) finalTranscript += piece + " ";
            else interimTranscript += piece;
          }
          onTranscript((finalTranscript + interimTranscript).trim());
        };

        recognition.onerror = (event) => {
          setRecording(false);
          if (event.error !== "no-speech" && event.error !== "aborted" && !gotAnyResult) {
            startFallbackRecording();
          } else if (event.error !== "no-speech" && event.error !== "aborted") {
            setError(`Speech recognition error: ${event.error}`);
          }
        };

        recognition.onend = () => setRecording(false);

        recognitionRef.current = recognition;
        recognition.start();
        setRecording(true);
        return;
      } catch {
        // falls through to the recorder-based fallback below
      }
    }

    startFallbackRecording();
  }, [onTranscript, startFallbackRecording]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const toggle = useCallback(() => {
    if (recording) stop();
    else start();
  }, [recording, start, stop]);

  return { recording, transcribing, error, toggle };
}
