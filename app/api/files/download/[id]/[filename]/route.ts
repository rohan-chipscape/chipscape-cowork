import { readFile } from "fs/promises";
import { getDocumentPath } from "@/lib/files/generateDocument";

type Params = { params: Promise<{ id: string; filename: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id, filename } = await params;
  const filePath = getDocumentPath(id);
  if (!filePath) {
    return new Response("Not found", { status: 404 });
  }

  const data = await readFile(filePath);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${decodeURIComponent(filename)}"`,
    },
  });
}
