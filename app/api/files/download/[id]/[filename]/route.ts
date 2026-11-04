import { readFile } from "fs/promises";
import { getGeneratedFile } from "@/lib/files/generatedFiles";

type Params = { params: Promise<{ id: string; filename: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id, filename } = await params;
  const file = getGeneratedFile(id);
  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  const data = await readFile(file.path);
  // Images render inline (so an <img> tag can show them directly in chat);
  // everything else downloads as an attachment.
  const disposition = file.contentType.startsWith("image/") ? "inline" : "attachment";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `${disposition}; filename="${decodeURIComponent(filename)}"`,
    },
  });
}
