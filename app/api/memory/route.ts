import { connection } from "next/server";
import { listFacts, addFact } from "@/lib/memory/store";

export async function GET() {
  await connection();
  return Response.json({ facts: listFacts() });
}

export async function POST(req: Request) {
  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) {
    return Response.json({ error: "Missing text" }, { status: 400 });
  }
  const fact = addFact(text);
  return Response.json(fact);
}
