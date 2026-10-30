import { extractFacts } from "@/lib/memory/extract";
import { addFact } from "@/lib/memory/store";

export async function POST(req: Request) {
  const { question, answer } = (await req.json()) as {
    question?: string;
    answer?: string;
  };
  if (!question || !answer) {
    return Response.json({ error: "Missing question/answer" }, { status: 400 });
  }

  const facts = await extractFacts(question, answer);
  const saved = facts.map((text) => addFact(text));
  return Response.json({ saved: saved.length > 0, facts: saved });
}
