import { executeTool } from "@/lib/agent/tools";
import type { AgentToolCall } from "@/lib/agent/types";
import { getSessionEmail } from "@/lib/auth/session";

// A document with one or more [DIAGRAM: ...] markers calls the image model
// once per diagram before the PDF can finish rendering, so this needs more
// headroom than a typical tool call.
export const maxDuration = 120;

type Body = {
  calls: AgentToolCall[];
  decisions: Record<string, boolean>;
};

export async function POST(req: Request) {
  const { calls, decisions } = (await req.json()) as Body;

  if (!Array.isArray(calls)) {
    return Response.json({ error: "Missing calls" }, { status: 400 });
  }

  const sessionEmail = await getSessionEmail();

  const results = await Promise.all(
    calls.map(async (call) => {
      if (!decisions[call.id]) {
        return {
          id: call.id,
          name: call.name,
          result: { denied: true, message: "The CEO did not approve this action." },
        };
      }

      let args: Record<string, unknown>;
      try {
        args = JSON.parse(call.arguments || "{}");
      } catch {
        // Malformed JSON almost always means the model's response got cut
        // off mid-generation (e.g. a long document hitting the token
        // limit) — surface that clearly instead of silently falling back
        // to {} and producing an empty document/result.
        return {
          id: call.id,
          name: call.name,
          result: {
            error:
              "The response got cut off before it finished (likely too long for one step). Try asking again, perhaps for a shorter or more focused version.",
          },
        };
      }

      try {
        const result = await executeTool(call.name, args, sessionEmail);
        return { id: call.id, name: call.name, result };
      } catch (err) {
        return {
          id: call.id,
          name: call.name,
          result: { error: err instanceof Error ? err.message : String(err) },
        };
      }
    })
  );

  return Response.json({ results });
}
