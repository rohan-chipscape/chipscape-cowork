import { removeFact } from "@/lib/memory/store";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  removeFact(id);
  return Response.json({ ok: true });
}
