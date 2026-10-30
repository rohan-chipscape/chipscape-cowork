import { classifyIntent } from "@/lib/agent/run";

export async function POST(req: Request) {
  const { question } = (await req.json()) as { question?: string };
  if (!question) {
    return Response.json({ error: "Missing question" }, { status: 400 });
  }

  try {
    const mode = await classifyIntent(question);
    return Response.json({ mode });
  } catch (err) {
    // If classification fails for any reason, fall back to the safe default.
    return Response.json({
      mode: "debate",
      warning: err instanceof Error ? err.message : String(err),
    });
  }
}
