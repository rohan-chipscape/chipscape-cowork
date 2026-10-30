import { decodeToPcm16kMono } from "@/lib/speech/audio";
import { transcribeAudio } from "@/lib/speech/whisper";

export const maxDuration = 60;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No audio file provided" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const pcm = await decodeToPcm16kMono(buffer);
    const text = await transcribeAudio(pcm);
    return Response.json({ text });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
