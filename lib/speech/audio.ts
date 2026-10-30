import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

/** Converts arbitrary audio (webm/opus, mp4, etc.) to 16kHz mono PCM f32 samples, via ffmpeg. */
export function decodeToPcm16kMono(input: Buffer): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg binary not found — did ffmpeg-static install correctly?"));
      return;
    }

    const ffmpeg = spawn(ffmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      "pipe:0",
      "-f",
      "f32le",
      "-ac",
      "1",
      "-ar",
      "16000",
      "pipe:1",
    ]);

    const chunks: Buffer[] = [];
    let stderr = "";

    ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));
    ffmpeg.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
        return;
      }
      const buffer = Buffer.concat(chunks);
      const samples = new Float32Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength / Float32Array.BYTES_PER_ELEMENT
      );
      resolve(new Float32Array(samples)); // copy, so it survives the buffer being GC'd
    });

    ffmpeg.stdin.write(input);
    ffmpeg.stdin.end();
  });
}
