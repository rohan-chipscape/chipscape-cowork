import PDFDocument from "pdfkit";
import { saveGeneratedFile, sanitizeFilename } from "./generatedFiles";
import { generateImageBuffer } from "./generateImage";

/**
 * Very small markdown-ish renderer: enough to make agent-generated content
 * (headings, bullet lists, bold, tables, diagrams) look like a real document
 * rather than a wall of plain text, without pulling in a full
 * markdown-to-PDF pipeline.
 */

function stripInlineMarkdown(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:|-]+\|?$/.test(line) && line.includes("-");
}

function parseTableRow(line: string): string[] {
  let l = line.trim();
  if (l.startsWith("|")) l = l.slice(1);
  if (l.endsWith("|")) l = l.slice(0, -1);
  return l.split("|").map((c) => stripInlineMarkdown(c.trim()));
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

function renderTable(doc: PDFKit.PDFDocument, rows: string[][]) {
  if (rows.length === 0) return;
  const colCount = Math.max(...rows.map((r) => r.length));
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = contentWidth / colCount;
  const cellPadding = 5;

  doc.moveDown(0.3);

  rows.forEach((row, rowIndex) => {
    const isHeader = rowIndex === 0;
    doc.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(9.5);

    const cellHeights = row.map((cell) =>
      doc.heightOfString(cell, { width: colWidth - cellPadding * 2 })
    );
    const rowHeight = Math.max(...cellHeights, 14) + cellPadding * 2;

    ensureSpace(doc, rowHeight);

    const startY = doc.y;
    const startX = doc.page.margins.left;

    if (isHeader) {
      doc.rect(startX, startY, contentWidth, rowHeight).fill("#f0f0f0");
      doc.fillColor("#000000");
    }

    row.forEach((cell, i) => {
      const x = startX + i * colWidth;
      doc.rect(x, startY, colWidth, rowHeight).stroke("#cccccc");
      doc.text(cell, x + cellPadding, startY + cellPadding, {
        width: colWidth - cellPadding * 2,
      });
    });

    doc.y = startY + rowHeight;
  });

  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(11);
}

async function renderDiagram(doc: PDFKit.PDFDocument, description: string) {
  try {
    const buffer = await generateImageBuffer(
      `A clean, professional, clearly labeled technical diagram on a plain white background, simple shapes and legible text labels, no decorative styling: ${description}`
    );
    const maxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.moveDown(0.5);
    ensureSpace(doc, 220);
    doc.image(buffer, { fit: [maxWidth, 360], align: "center" });
    doc.moveDown(0.3);
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor("#666666")
      .text(description, { align: "center" });
    doc.fillColor("#000000").font("Helvetica").fontSize(11);
    doc.moveDown(0.5);
  } catch {
    doc
      .font("Helvetica-Oblique")
      .fontSize(10)
      .fillColor("#999999")
      .text(`[Diagram could not be generated: ${description}]`);
    doc.fillColor("#000000").font("Helvetica").fontSize(11);
  }
}

async function renderBody(doc: PDFKit.PDFDocument, content: string) {
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();

    if (line.trim() === "") {
      doc.moveDown(0.5);
      i++;
      continue;
    }

    if (
      line.trim().startsWith("|") &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1].trim())
    ) {
      const tableLines = [line];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        tableLines.push(lines[j]);
        j++;
      }
      renderTable(doc, tableLines.map(parseTableRow));
      i = j;
      continue;
    }

    const diagram = line.match(/^\[DIAGRAM:\s*(.+)\]$/i);
    if (diagram) {
      await renderDiagram(doc, diagram[1]);
      i++;
      continue;
    }

    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);
    const bullet = line.match(/^[-*]\s+(.*)/);

    if (h1) {
      doc.moveDown(0.5).font("Helvetica-Bold").fontSize(16).text(stripInlineMarkdown(h1[1]));
      doc.font("Helvetica").fontSize(11);
    } else if (h2) {
      doc.moveDown(0.4).font("Helvetica-Bold").fontSize(13).text(stripInlineMarkdown(h2[1]));
      doc.font("Helvetica").fontSize(11);
    } else if (bullet) {
      doc.text(`•  ${stripInlineMarkdown(bullet[1])}`, { indent: 14 });
    } else {
      doc.text(stripInlineMarkdown(line));
    }
    i++;
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
  await renderBody(doc, content);
  doc.end();

  await new Promise<void>((resolve, reject) => {
    doc.on("end", () => resolve());
    doc.on("error", reject);
  });

  const { id } = saveGeneratedFile(Buffer.concat(chunks), "pdf");
  return { id, filename: `${sanitizeFilename(title)}.pdf` };
}
