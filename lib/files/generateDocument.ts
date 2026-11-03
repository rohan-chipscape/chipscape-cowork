import { randomUUID } from "crypto";
import { mkdirSync, createWriteStream, existsSync } from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const FILES_DIR = path.join(process.cwd(), ".data", "files");

function ensureDir() {
  if (!existsSync(FILES_DIR)) mkdirSync(FILES_DIR, { recursive: true });
}

function sanitizeFilename(title: string): string {
  const base = title.trim().replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "Document";
  return base.slice(0, 80);
}

/**
 * Very small markdown-ish renderer: enough to make agent-generated content
 * (headings, bullet lists, bold) look like a real document rather than a
 * wall of plain text, without pulling in a full markdown-to-PDF pipeline.
 */
function renderBody(doc: PDFKit.PDFDocument, content: string) {
  const lines = content.split("\n");
  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim() === "") {
      doc.moveDown(0.5);
      continue;
    }

    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);
    const bullet = line.match(/^[-*]\s+(.*)/);

    if (h1) {
      doc.moveDown(0.5).font("Helvetica-Bold").fontSize(16).text(h1[1]);
      doc.font("Helvetica").fontSize(11);
      continue;
    }
    if (h2) {
      doc.moveDown(0.4).font("Helvetica-Bold").fontSize(13).text(h2[1]);
      doc.font("Helvetica").fontSize(11);
      continue;
    }
    if (bullet) {
      doc.text(`•  ${bullet[1]}`, { indent: 14 });
      continue;
    }
    doc.text(line);
  }
}

export async function createPdfDocument(
  title: string,
  content: string
): Promise<{ id: string; filename: string }> {
  ensureDir();
  const id = randomUUID();
  const filename = `${sanitizeFilename(title)}.pdf`;
  const filePath = path.join(FILES_DIR, `${id}.pdf`);

  const doc = new PDFDocument({ margin: 54 });
  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  doc.font("Helvetica-Bold").fontSize(20).text(title);
  doc.moveDown();
  doc.font("Helvetica").fontSize(11);
  renderBody(doc, content);

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });

  return { id, filename };
}

export function getDocumentPath(id: string): string | null {
  // id comes straight from the URL param — reject anything that isn't a bare
  // UUID before it ever touches the filesystem, so no path traversal is possible.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const filePath = path.join(FILES_DIR, `${id}.pdf`);
  return existsSync(filePath) ? filePath : null;
}
