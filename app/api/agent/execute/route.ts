import { executeTool } from "@/lib/agent/tools";
import type { AgentToolCall } from "@/lib/agent/types";
import { getSessionEmail } from "@/lib/auth/session";

export const maxDuration = 60;

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

      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.arguments || "{}");
      } catch {
        // malformed arguments from the model — pass through empty args
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
