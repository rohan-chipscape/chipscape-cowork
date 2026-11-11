import { extractText, heicToJpeg } from "@/lib/files/extract";

// 10MB was rejecting entirely normal reports/decks/scanned contracts outright
// before they even got a chance to be read. 50MB comfortably covers that
// without risking the server on something absurd (a multi-GB video file).
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

function imageMimeType(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  // .heic/.heif are converted to JPEG below before this is used — vision
  // models and browsers don't widely support HEIC directly.
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/jpeg";
  return null;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return Response.json({ error: "File is too large (max 50MB)" }, { status: 400 });
  }

  const { text, error } = await extractText(file);
  if (error) {
    return Response.json({ error }, { status: 422 });
  }

  // For images, also hand back the raw image as a data URL so the model can
  // actually *see* it (charts, photos, handwriting, diagrams) instead of
  // relying only on OCR'd text, which misses anything that isn't plain text.
  const lowerName = file.name.toLowerCase();
  let imageDataUrl: string | undefined;
  if (IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    const mime = imageMimeType(lowerName);
    if (mime) {
      let buffer: Buffer = Buffer.from(await file.arrayBuffer());
      if (lowerName.endsWith(".heic") || lowerName.endsWith(".heif")) {
        buffer = await heicToJpeg(buffer);
      }
      imageDataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
    }
  }

  return Response.json({ name: file.name, text, imageDataUrl });
}
