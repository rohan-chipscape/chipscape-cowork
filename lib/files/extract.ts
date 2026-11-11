import { ocrImageBuffer, ocrScannedPdf } from "./ocr";

// This is the ceiling for how much of a document we'll ever READ at all —
// not how much gets pasted into one prompt (see INLINE_CHAR_LIMIT in the
// upload route, which decides between inlining the text directly and
// building a searchable chunk index for documents bigger than that). 1M
// characters comfortably covers even a few-hundred-page document.
const MAX_CHARS = 1000000;
// If a "normal" PDF text extraction comes back shorter than this, it's
// almost certainly a scanned/image-only PDF rather than a real text layer.
const MIN_TEXT_LAYER_CHARS = 30;

// An iPhone photo is .heic by default — decode it to JPEG first so both OCR
// and the vision data URL (see app/api/files/upload/route.ts) can use it,
// the same as any other image.
export async function heicToJpeg(buffer: Buffer): Promise<Buffer> {
  const convert = (await import("heic-convert")).default;
  const out = await convert({ buffer, format: "JPEG", quality: 0.9 });
  return Buffer.from(out);
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// .pptx is a zip of XML parts — no need for a full OOXML parser, just pull
// the text runs (<a:t>...</a:t>) out of each slide's XML, in slide order.
async function extractPptxText(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const slidePaths = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)![1], 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)![1], 10);
      return na - nb;
    });

  const slides: string[] = [];
  for (const path of slidePaths) {
    const xml = await zip.files[path].async("string");
    const runs = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) =>
      decodeXmlEntities(m[1])
    );
    slides.push(runs.join(" ").trim());
  }

  return slides
    .map((text, i) => `## Slide ${i + 1}\n${text || "(no text on this slide)"}`)
    .join("\n\n");
}

// The actual per-format extraction logic, keyed off a filename (for its
// extension) and raw bytes — not tied to the browser/web File type, so
// web_fetch can run the exact same logic on a downloaded URL's bytes
// instead of duplicating (and inevitably drifting from) this per format.
export async function extractTextFromBuffer(
  buffer: Buffer,
  name: string
): Promise<{ text: string; error?: string }> {
  const lower = name.toLowerCase();

  try {
    if (lower.endsWith(".pdf")) {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();

      if (result.text.trim().length >= MIN_TEXT_LAYER_CHARS) {
        return { text: result.text.slice(0, MAX_CHARS) };
      }
      // No real text layer — looks scanned. Try OCR on the rendered pages;
      // if that pipeline itself fails (pdfjs-dist + node-canvas's image
      // rendering is fragile for some PDFs), give an actionable error
      // instead of a cryptic native one.
      try {
        const ocrText = await ocrScannedPdf(buffer);
        return { text: ocrText.slice(0, MAX_CHARS) };
      } catch {
        return {
          text: "",
          error:
            `"${name}" looks like a scanned PDF with no selectable text, and we couldn't render ` +
            "it for OCR. Try exporting/saving each page as a JPG or PNG image and uploading that instead.",
        };
      }
    }

    if (lower.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer });
      return { text: value.slice(0, MAX_CHARS) };
    }

    if (lower.endsWith(".pptx")) {
      const text = await extractPptxText(buffer);
      return { text: text.slice(0, MAX_CHARS) };
    }

    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheets = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        return `## Sheet: ${sheetName}\n${csv}`;
      });
      return { text: sheets.join("\n\n").slice(0, MAX_CHARS) };
    }

    if (
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp") ||
      lower.endsWith(".heic") ||
      lower.endsWith(".heif")
    ) {
      const imageBuffer =
        lower.endsWith(".heic") || lower.endsWith(".heif") ? await heicToJpeg(buffer) : buffer;
      const text = await ocrImageBuffer(imageBuffer);
      return { text: text.slice(0, MAX_CHARS) };
    }

    if (
      lower.endsWith(".txt") ||
      lower.endsWith(".md") ||
      lower.endsWith(".csv") ||
      lower.endsWith(".json")
    ) {
      return { text: buffer.toString("utf-8").slice(0, MAX_CHARS) };
    }

    return { text: "", error: `Unsupported file type: ${name}` };
  } catch (err) {
    return {
      text: "",
      error: `Couldn't read ${name}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function extractText(
  file: File
): Promise<{ text: string; error?: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return extractTextFromBuffer(buffer, file.name);
}
