import PDFDocument from "pdfkit";
import { saveGeneratedFile, sanitizeFilename } from "./generatedFiles";

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
  const doc = new PDFDocument({ margin: 54 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  doc.font("Helvetica-Bold").fontSize(20).text(title);
  doc.moveDown();
  doc.font("Helvetica").fontSize(11);
  renderBody(doc, content);
  doc.end();

  await new Promise<void>((resolve, reject) => {
    doc.on("end", () => resolve());
    doc.on("error", reject);
  });

  const { id } = saveGeneratedFile(Buffer.concat(chunks), "pdf");
  return { id, filename: `${sanitizeFilename(title)}.pdf` };
}
