import { GoogleGenAI } from "@google/genai";
import { saveGeneratedFile, sanitizeFilename } from "./generatedFiles";

/**
 * Generates an image from a text prompt using Gemini's native image-output
 * model. (Google's dedicated Imagen models need a paid Vertex AI / "Gemini
 * Enterprise Agent Platform" project, not a plain Developer API key like
 * ours — this model works with the regular GEMINI_API_KEY.)
 */
export async function generateImage(
  prompt: string,
  title?: string
): Promise<{ id: string; filename: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: prompt,
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error("Gemini didn't return an image for that prompt.");
  }

  const buffer = Buffer.from(imagePart.inlineData.data, "base64");
  const { id } = saveGeneratedFile(buffer, "png");
  const filename = `${sanitizeFilename(title ?? prompt.slice(0, 60))}.png`;
  return { id, filename };
}
