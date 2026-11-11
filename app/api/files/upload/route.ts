import { extractText, heicToJpeg } from "@/lib/files/extract";
import { buildDocumentIndex } from "@/lib/files/documentIndex";

// Matches ChatGPT's own published per-file limit. The server has plenty of
// headroom for this (14GB RAM, <1% used) — the real constraint on a huge
// scanned file is processing time (OCR), not raw bytes, which the earlier
// 180s nginx timeout bump already helps with.
const MAX_FILE_BYTES = 512 * 1024 * 1024; // 512 MB
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

// A document longer than this doesn't get pasted into the prompt directly —
// instead of silently truncating (the old behavior) or blowing up the
// context on every single message regardless of what was asked, it gets
// chunked + embedded once here, and the agent calls search_document to pull
// in only the parts actually relevant to each question — the same
// chunk-and-retrieve approach ChatGPT itself uses for large files, instead
// of re-reading the whole document on every turn.
const INLINE_CHAR_LIMIT = 12000;

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
    return Response.json({ error: "File is too large (max 512MB)" }, { status: 400 });
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

  // Images are always handled via imageDataUrl (vision) — never worth
  // chunking their OCR'd text, which is usually short anyway.
  const isImage = IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  if (!isImage && text.length > INLINE_CHAR_LIMIT) {
    const fileId = crypto.randomUUID();
    await buildDocumentIndex(fileId, file.name, text);
    return Response.json({
      name: file.name,
      text: text.slice(0, 2000),
      fileId,
      needsRetrieval: true,
      fullLength: text.length,
    });
  }

  return Response.json({ name: file.name, text, imageDataUrl });
}
