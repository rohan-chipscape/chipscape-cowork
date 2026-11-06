import PDFDocument from "pdfkit";
import { saveGeneratedFile, sanitizeFilename } from "./generatedFiles";
import { generateImageBuffer } from "./generateImage";

/**
 * Small markdown-ish renderer: enough to make agent-generated content
 * (headings, bullet/numbered lists, bold/italic/code/links, tables,
 * diagrams) look like a real document rather than a wall of plain text
 * with stray '#'/'*' characters, without pulling in a full
 * markdown-to-PDF pipeline.
 */

const ACCENT = "#2c67c5"; // same blue as the app's own send button
const ACCENT_DARK = "#173e76"; // same navy as the app's user-message bubble
const TEXT_COLOR = "#1a1a1a";
const MUTED = "#666666";

type InlineSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: string;
};

// Splits a line into runs of plain/bold/italic/code/link text instead of
// just deleting the markdown markers — so "**Important:**" actually renders
// bold rather than silently losing the emphasis along with the asterisks.
function parseInlineSegments(raw: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const re = /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    if (match.index > lastIndex) {
      segments.push({ text: raw.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ text: match[1], code: true });
    } else if (match[2] !== undefined) {
      segments.push({ text: match[2], link: match[3] });
    } else if (match[4] !== undefined) {
      segments.push({ text: match[4], bold: true });
    } else if (match[5] !== undefined) {
      segments.push({ text: match[5], italic: true });
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < raw.length) segments.push({ text: raw.slice(lastIndex) });
  return segments.length ? segments : [{ text: raw }];
}

// Flattened plain text for spots (table cells, diagram captions) where a
// single text() call per position makes true inline styling impractical.
function stripInlineMarkdown(text: string): string {
  return parseInlineSegments(text)
    .map((s) => s.text)
    .join("");
}

function fontFor(baseBold: boolean, seg: InlineSegment): string {
  if (seg.code) return baseBold ? "Courier-Bold" : "Courier";
  const bold = baseBold || seg.bold;
  const italic = !!seg.italic;
  if (bold && italic) return "Helvetica-BoldOblique";
  if (bold) return "Helvetica-Bold";
  if (italic) return "Helvetica-Oblique";
  return "Helvetica";
}

// Renders a pre-built run of segments as one flowing paragraph, each run
// keeping its own font/color but all continuing on the same line(s) —
// this is what makes inline bold/italic/code/links actually look right
// instead of just having their markup characters stripped out.
function renderInlineSegments(
  doc: PDFKit.PDFDocument,
  segments: InlineSegment[],
  opts: { size: number; color: string; baseBold?: boolean; indent?: number }
) {
  segments.forEach((seg, idx) => {
    const isLast = idx === segments.length - 1;
    doc.font(fontFor(!!opts.baseBold, seg)).fontSize(seg.code ? opts.size - 0.5 : opts.size);
    doc.fillColor(seg.link ? ACCENT : opts.color);
    const textOptions: PDFKit.Mixins.TextOptions = { continued: !isLast };
    if (idx === 0 && opts.indent) textOptions.indent = opts.indent;
    if (seg.link) {
      textOptions.link = seg.link;
      textOptions.underline = true;
    }
    doc.text(seg.text, textOptions);
  });
  doc.fillColor(TEXT_COLOR).font("Helvetica").fontSize(11);
}

function renderInlineText(
  doc: PDFKit.PDFDocument,
  raw: string,
  opts: { size: number; color: string; baseBold?: boolean; indent?: number }
) {
  renderInlineSegments(doc, parseInlineSegments(raw), opts);
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:|-]+\|?$/.test(line) && line.includes("-");
}

function isHorizontalRule(line: string): boolean {
  return /^(-{3,}|_{3,}|\*{3,})$/.test(line);
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
      doc.rect(startX, startY, contentWidth, rowHeight).fill(ACCENT);
      doc.fillColor("#ffffff");
    } else if (rowIndex % 2 === 0) {
      // Faint zebra striping on data rows reads much cleaner than a wall of
      // identical white rows once a table runs past a handful of entries.
      doc.rect(startX, startY, contentWidth, rowHeight).fill("#f6f8fb");
      doc.fillColor(TEXT_COLOR);
    } else {
      doc.fillColor(TEXT_COLOR);
    }

    row.forEach((cell, i) => {
      const x = startX + i * colWidth;
      doc.rect(x, startY, colWidth, rowHeight).stroke("#d8dde3");
      doc.fillColor(isHeader ? "#ffffff" : TEXT_COLOR).text(cell, x + cellPadding, startY + cellPadding, {
        width: colWidth - cellPadding * 2,
      });
    });

    doc.y = startY + rowHeight;
    // Each cell's text() call was given an explicit x, which leaves
    // PDFKit's cursor sitting at the last cell drawn — reset it back to
    // the left margin so the next row (or the text after the table) isn't
    // squeezed into whatever's left of the page from that x onward.
    doc.x = doc.page.margins.left;
  });

  doc.moveDown(0.5);
  doc.fillColor(TEXT_COLOR).font("Helvetica").fontSize(11);
}

async function renderDiagram(doc: PDFKit.PDFDocument, description: string) {
  // Defensive: a preceding table's explicit-x cell text can leave the
  // cursor shifted (see renderTable's own reset for the main case).
  doc.x = doc.page.margins.left;
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
      .fillColor(MUTED)
      .text(description, { align: "center" });
    doc.fillColor(TEXT_COLOR).font("Helvetica").fontSize(11);
    doc.moveDown(0.5);
  } catch {
    doc
      .font("Helvetica-Oblique")
      .fontSize(10)
      .fillColor("#999999")
      .text(`[Diagram could not be generated: ${description}]`);
    doc.fillColor(TEXT_COLOR).font("Helvetica").fontSize(11);
  }
}

async function renderBody(doc: PDFKit.PDFDocument, content: string) {
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i].trimEnd();
    const line = rawLine.trim();

    if (line === "") {
      doc.moveDown(0.5);
      i++;
      continue;
    }

    if (
      line.startsWith("|") &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1].trim())
    ) {
      const tableLines = [line];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        tableLines.push(lines[j].trim());
        j++;
      }
      renderTable(doc, tableLines.map(parseTableRow));
      i = j;
      continue;
    }

    // The model sometimes writes a multi-line description inside the
    // brackets (with its own bullet points) instead of putting it all on
    // one line — collect lines until the closing ']' shows up, rather than
    // requiring a single-line match.
    const diagramStart = line.match(/^\[DIAGRAM:\s*(.*)$/i);
    if (diagramStart) {
      const descLines = [diagramStart[1]];
      let j = i;
      // Cap how far we'll scan for a closing ']' so a missing bracket
      // can't swallow the rest of the document into one "diagram".
      while (
        !descLines[descLines.length - 1].trimEnd().endsWith("]") &&
        j + 1 < lines.length &&
        j - i < 20
      ) {
        j++;
        descLines.push(lines[j].trim());
      }
      let desc = descLines.join(" ").trim();
      if (desc.endsWith("]")) {
        desc = desc.slice(0, -1).trim();
        await renderDiagram(doc, desc);
        i = j + 1;
        continue;
      }
      // No closing bracket found within the cap — treat the original line
      // as ordinary text instead of guessing.
    }

    if (isHorizontalRule(line)) {
      doc.moveDown(0.3);
      const y = doc.y;
      doc
        .strokeColor("#dddddd")
        .lineWidth(1)
        .moveTo(doc.page.margins.left, y)
        .lineTo(doc.page.width - doc.page.margins.right, y)
        .stroke();
      doc.moveDown(0.5);
      i++;
      continue;
    }

    // Any heading depth (#, ##, ### ...), not just '#'/'##' — a stray
    // '### Subsection' used to fall through to plain text and show its
    // literal hashes instead of being styled.
    const heading = line.match(/^(#{1,6})\s+(.*)/);
    const checkbox = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)/);
    const numbered = line.match(/^(\d+)\.\s+(.*)/);
    const bullet = line.match(/^[-*]\s+(.*)/);

    if (heading) {
      const level = heading[1].length;
      const sizeByLevel: Record<number, number> = { 1: 18, 2: 14, 3: 12.5, 4: 11.5, 5: 11, 6: 11 };
      const colorByLevel: Record<number, string> = {
        1: ACCENT_DARK,
        2: ACCENT,
        3: "#333333",
        4: "#444444",
        5: "#444444",
        6: "#444444",
      };
      doc.moveDown(level <= 2 ? 0.5 : 0.35);
      renderInlineText(doc, heading[2], {
        size: sizeByLevel[level] ?? 11,
        color: colorByLevel[level] ?? TEXT_COLOR,
        baseBold: true,
      });
    } else if (checkbox) {
      // PDFKit's standard fonts only cover WinAnsi/Latin-1, which has no
      // real checkbox glyph — a Unicode box-drawing character here renders
      // as garbage instead of a checkbox, so stick to plain brackets.
      const checked = checkbox[1].toLowerCase() === "x";
      doc.font("Helvetica-Bold").fontSize(11).fillColor(ACCENT);
      doc.text(checked ? "[x]  " : "[ ]  ", { continued: true, indent: 14 });
      renderInlineText(doc, checkbox[2], { size: 11, color: TEXT_COLOR });
    } else if (numbered) {
      const leadingSpaces = rawLine.length - rawLine.trimStart().length;
      const nestLevel = Math.min(3, Math.floor(leadingSpaces / 2));
      doc.font("Helvetica-Bold").fontSize(11).fillColor(ACCENT);
      doc.text(`${numbered[1]}.  `, { continued: true, indent: 14 + nestLevel * 16 });
      renderInlineText(doc, numbered[2], { size: 11, color: TEXT_COLOR });
    } else if (bullet) {
      const leadingSpaces = rawLine.length - rawLine.trimStart().length;
      const nestLevel = Math.min(3, Math.floor(leadingSpaces / 2));
      // Same WinAnsi/Latin-1 constraint as checkboxes above — "•" (bullet)
      // and "·" (middle dot) are both in that charset and render
      // correctly; "◦"/"▪" aren't and come out as garbled glyphs.
      const bulletChar = nestLevel === 0 ? "•" : nestLevel === 1 ? "-" : "·";
      doc.font("Helvetica").fontSize(11).fillColor(ACCENT);
      doc.text(`${bulletChar}  `, { continued: true, indent: 14 + nestLevel * 16 });
      renderInlineText(doc, bullet[1], { size: 11, color: TEXT_COLOR });
    } else {
      renderInlineText(doc, line, { size: 11, color: TEXT_COLOR });
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

  doc.font("Helvetica-Bold").fontSize(20).fillColor(ACCENT_DARK).text(title);
  doc.moveDown();
  doc.fillColor(TEXT_COLOR).font("Helvetica").fontSize(11);
  await renderBody(doc, content);
  doc.end();

  await new Promise<void>((resolve, reject) => {
    doc.on("end", () => resolve());
    doc.on("error", reject);
  });

  const { id } = saveGeneratedFile(Buffer.concat(chunks), "pdf");
  return { id, filename: `${sanitizeFilename(title)}.pdf` };
}
