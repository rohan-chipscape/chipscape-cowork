import { extractText } from "@/lib/files/extract";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return Response.json({ error: "File is too large (max 10MB)" }, { status: 400 });
  }

  const { text, error } = await extractText(file);
  if (error) {
    return Response.json({ error }, { status: 422 });
  }

  return Response.json({ name: file.name, text });
}
