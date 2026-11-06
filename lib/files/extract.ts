import { ocrImageBuffer, ocrScannedPdf } from "./ocr";

const MAX_CHARS = 20000;
// If a "normal" PDF text extraction comes back shorter than this, it's
// almost certainly a scanned/image-only PDF rather than a real text layer.
const MIN_TEXT_LAYER_CHARS = 30;

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

export async function extractText(
  file: File
): Promise<{ text: string; error?: string }> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (name.endsWith(".pdf")) {
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
            `"${file.name}" looks like a scanned PDF with no selectable text, and we couldn't render ` +
            "it for OCR. Try exporting/saving each page as a JPG or PNG image and uploading that instead.",
        };
      }
    }

    if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer });
      return { text: value.slice(0, MAX_CHARS) };
    }

    if (name.endsWith(".pptx")) {
      const text = await extractPptxText(buffer);
      return { text: text.slice(0, MAX_CHARS) };
    }

    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
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
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".png") ||
      name.endsWith(".webp")
    ) {
      const text = await ocrImageBuffer(buffer);
      return { text: text.slice(0, MAX_CHARS) };
    }

    if (
      name.endsWith(".txt") ||
      name.endsWith(".md") ||
      name.endsWith(".csv") ||
      name.endsWith(".json")
    ) {
      return { text: buffer.toString("utf-8").slice(0, MAX_CHARS) };
    }

    return { text: "", error: `Unsupported file type: ${file.name}` };
  } catch (err) {
    return {
      text: "",
      error: `Couldn't read ${file.name}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
