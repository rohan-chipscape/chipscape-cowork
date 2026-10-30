// Local, free, no-API-key speech-to-text for browsers without a usable
// Web Speech API (Safari/Firefox). Runs a small Whisper model fully on this
// server via transformers.js — the JS equivalent of faster-whisper.
let pipelinePromise: Promise<any> | null = null;

async function getTranscriber() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import("@xenova/transformers");
      return pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en");
    })();
  }
  return pipelinePromise;
}

export async function transcribeAudio(audio: Float32Array): Promise<string> {
  const transcriber = await getTranscriber();
  const result = await transcriber(audio);
  const text = Array.isArray(result) ? result[0]?.text : result.text;
  return (text ?? "").trim();
}
