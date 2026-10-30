import { runAgentStep } from "@/lib/agent/run";
import type { AgentMessage } from "@/lib/agent/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { transcript } = (await req.json()) as { transcript?: AgentMessage[] };

  if (!Array.isArray(transcript) || transcript.length === 0) {
    return Response.json({ error: "Missing transcript" }, { status: 400 });
  }

  try {
    const result = await runAgentStep(transcript);
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { type: "error", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
