// OCR for photos of documents and scanned (image-only) PDFs. Entirely
// pure-JS/WASM (tesseract.js, pngjs) — no native addons or system packages
// (poppler/imagemagick/cairo) needed in the Docker image.
const MAX_OCR_PAGES = 8; // scanned PDFs can be slow/expensive to OCR page-by-page

export async function ocrImageBuffer(buffer: Buffer): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(buffer);
    return text;
  } finally {
    await worker.terminate();
  }
}

type PdfImageData = {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  kind: number; // pdfjs ImageKind: 1=GRAYSCALE_1BPP, 2=RGB_24BPP, 3=RGBA_32BPP
};

/**
 * Converts whatever pixel format pdfjs decoded the embedded scan into, into
 * plain interleaved RGBA — the one format every PNG encoder understands.
 */
function toRGBA({ data, width, height, kind }: PdfImageData): Uint8Array {
  const out = new Uint8Array(width * height * 4);

  if (kind === 3) {
    // Already RGBA.
    out.set(data.subarray(0, out.length));
    return out;
  }

  if (kind === 2) {
    // RGB, no alpha — insert a fully-opaque alpha byte after every pixel.
    for (let p = 0, s = 0; p < width * height; p++, s += 3) {
      out[p * 4] = data[s];
      out[p * 4 + 1] = data[s + 1];
      out[p * 4 + 2] = data[s + 2];
      out[p * 4 + 3] = 255;
    }
    return out;
  }

  // GRAYSCALE_1BPP: one bit per pixel, packed 8-to-a-byte, each row padded
  // to a whole byte — the classic bitonal fax-style scan format.
  const bytesPerRow = Math.ceil(width / 8);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const byte = data[y * bytesPerRow + (x >> 3)];
      const bit = (byte >> (7 - (x % 8))) & 1;
      const v = bit ? 255 : 0;
      const p = (y * width + x) * 4;
      out[p] = v;
      out[p + 1] = v;
      out[p + 2] = v;
      out[p + 3] = 255;
    }
  }
  return out;
}

/**
 * OCRs a scanned (text-less) PDF by pulling the embedded page-scan image(s)
 * straight out of the PDF's own decoded objects — not by rendering pages
 * through a Canvas2D implementation. pdfjs-dist's renderer calls Canvas
 * methods real browsers support but Node canvas libraries implement
 * incompletely or incompatibly (confirmed: both @napi-rs/canvas, which
 * crashes the process natively, and node-canvas, which throws "Image or
 * Canvas expected" on the same image XObjects). Going straight to the
 * decoded pixel data sidesteps that whole rendering pipeline.
 */
export async function ocrScannedPdf(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { PNG } = await import("pngjs");

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageCount = Math.min(doc.numPages, MAX_OCR_PAGES);
  const pageTexts: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    // Building the operator list is what makes pdfjs actually decode each
    // image XObject's pixels into page.objs — render() normally triggers
    // this as a side effect of drawing, but we need the data, not a drawing.
    const opList = await page.getOperatorList();

    let imgData: PdfImageData | null = null;
    for (let j = 0; j < opList.fnArray.length; j++) {
      if (opList.fnArray[j] !== pdfjsLib.OPS.paintImageXObject) continue;
      const objId = opList.argsArray[j][0] as string;
      const data = await new Promise<PdfImageData | null>((resolve) => page.objs.get(objId, resolve));
      if (data?.data) {
        imgData = data; // a scanned page is normally exactly one full-page image
        break;
      }
    }

    if (!imgData) {
      pageTexts.push(`## Page ${i}\n[No embedded scan image found on this page.]`);
      continue;
    }

    const png = new PNG({ width: imgData.width, height: imgData.height });
    png.data = Buffer.from(toRGBA(imgData));
    const pngBuffer = PNG.sync.write(png);

    const text = await ocrImageBuffer(pngBuffer);
    pageTexts.push(`## Page ${i}\n${text.trim()}`);
  }

  if (doc.numPages > MAX_OCR_PAGES) {
    pageTexts.push(`\n[Only the first ${MAX_OCR_PAGES} of ${doc.numPages} pages were OCR'd.]`);
  }

  return pageTexts.join("\n\n");
}
