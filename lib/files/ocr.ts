// OCR for photos of documents and scanned (image-only) PDFs. Pure-JS/WASM
// (tesseract.js) plus prebuilt-binary canvas/pdf rendering (no system
// packages like poppler/imagemagick needed in the Docker image).
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

/**
 * pdfjs-dist creates its own internal canvases while rendering (for image
 * XObjects, patterns, etc.), not just the one we hand it — if those use a
 * different/incompatible canvas implementation than ours, node-canvas
 * throws "Image or Canvas expected" deep inside native code. Passing this
 * factory (the pattern from pdfjs-dist's own Node examples) makes every
 * canvas pdfjs creates, anywhere, a real node-canvas one.
 */
class NodeCanvasFactory {
  #createCanvas: (width: number, height: number) => import("canvas").Canvas;

  constructor(createCanvas: (width: number, height: number) => import("canvas").Canvas) {
    this.#createCanvas = createCanvas;
  }

  create(width: number, height: number) {
    const canvas = this.#createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }

  reset(canvasAndContext: { canvas: import("canvas").Canvas }, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: { canvas: import("canvas").Canvas | null; context: unknown }) {
    canvasAndContext.canvas!.width = 0;
    canvasAndContext.canvas!.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

/** Renders each page of a (likely scanned, text-less) PDF to an image and OCRs it. */
export async function ocrScannedPdf(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("canvas");
  const canvasFactory = new NodeCanvasFactory(createCanvas);

  // pdfjs-dist's public .d.ts doesn't model the Node-specific canvasFactory
  // option (it's documented and supported at runtime, in pdfjs-dist's own
  // Node examples, just not typed), so this needs a cast past it.
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    canvasFactory,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any).promise;
  const pageCount = Math.min(doc.numPages, MAX_OCR_PAGES);
  const pageTexts: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 }); // higher scale = better OCR accuracy
    const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);

    await page.render({
      canvasContext: context,
      viewport,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).promise;

    const pngBuffer = canvas.toBuffer("image/png");
    const text = await ocrImageBuffer(pngBuffer);
    pageTexts.push(`## Page ${i}\n${text.trim()}`);
  }

  if (doc.numPages > MAX_OCR_PAGES) {
    pageTexts.push(`\n[Only the first ${MAX_OCR_PAGES} of ${doc.numPages} pages were OCR'd.]`);
  }

  return pageTexts.join("\n\n");
}
