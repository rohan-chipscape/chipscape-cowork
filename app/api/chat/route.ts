import Anthropic from "@anthropic-ai/sdk";
import { PROVIDERS } from "@/lib/providers";
import type { ChatMessage, ProviderResult } from "@/lib/providers/types";
import {
  buildPanelSystemPrompt,
  buildSynthesisSystemPrompt,
  buildSynthesisPrompt,
} from "@/lib/debate";

export const maxDuration = 120;

type Body = {
  messages: ChatMessage[];
};

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  const { messages } = (await req.json()) as Body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("Missing messages", { status: 400 });
  }

  const question = messages[messages.length - 1]?.content ?? "";

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(sseEvent(event, data)));

      send("panel", {
        models: PROVIDERS.map((p) => ({ id: p.id, label: p.label })),
      });

      const panelSystemPrompt = buildPanelSystemPrompt();
      const results: ProviderResult[] = await Promise.all(
        PROVIDERS.map(async (p) => {
          const result = await p.fn(messages, panelSystemPrompt);
          send("model_done", result);
          return result;
        })
      );

      const anySuccess = results.some((r) => !r.error && r.text.trim());
      if (!anySuccess) {
        send("synthesis_error", {
          message: "All models failed to respond. Check API keys and try again.",
        });
        send("done", {});
        controller.close();
        return;
      }

      send("synthesis_start", {});

      const synthesisMessages = buildSynthesisPrompt(question, results);
      const synthesisSystemPrompt = buildSynthesisSystemPrompt();
      const workingProviders = results
        .filter((r) => !r.error)
        .map((r) => r.provider);
      const preferredJudge = process.env.JUDGE_PROVIDER;
      const judgeOrder = [
        ...(preferredJudge ? [preferredJudge] : []),
        ...workingProviders,
        ...PROVIDERS.map((p) => p.id),
      ].filter((id, i, arr) => arr.indexOf(id) === i);

      let synthesized = false;
      let lastError = "";

      for (const providerId of judgeOrder) {
        if (synthesized) break;

        if (providerId === "anthropic") {
          try {
            const apiKey = process.env.ANTHROPIC_API_KEY;
            if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
            const client = new Anthropic({ apiKey });

            const streamResp = client.messages.stream({
              model: "claude-sonnet-5-5",
              max_tokens: 2000,
              system: synthesisSystemPrompt,
              messages: synthesisMessages,
            });

            let announced = false;
            streamResp.on("text", (delta) => {
              if (!announced) {
                announced = true;
                send("synthesis_judge", { provider: "anthropic", label: "Claude" });
              }
              send("synthesis_chunk", { text: delta });
            });

            await streamResp.finalMessage();
            synthesized = true;
          } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
          }
          continue;
        }

        const provider = PROVIDERS.find((p) => p.id === providerId);
        if (!provider) continue;

        const judged = await provider.fn(synthesisMessages, synthesisSystemPrompt);
        if (!judged.error && judged.text.trim()) {
          send("synthesis_judge", { provider: provider.id, label: provider.label });
          send("synthesis_chunk", { text: judged.text });
          synthesized = true;
        } else {
          lastError = judged.error ?? lastError;
        }
      }

      if (!synthesized) {
        send("synthesis_error", {
          message: lastError || "No model was able to synthesize a final answer.",
        });
      }

      send("done", {});
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
