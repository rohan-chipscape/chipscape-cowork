const MAX_CHARS = 20000;

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
      return { text: result.text.slice(0, MAX_CHARS) };
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
