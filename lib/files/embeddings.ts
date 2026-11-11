import { getAgentClient } from "../agent/client";

const EMBEDDING_MODEL = "text-embedding-3-small";
// OpenAI's embeddings endpoint accepts a batch of inputs in one call — doing
// this in batches instead of one request per chunk keeps indexing a large
// document fast and cheap.
const BATCH_SIZE = 100;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { client } = getAgentClient();
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await client.embeddings.create({ model: EMBEDDING_MODEL, input: batch });
    vectors.push(...res.data.map((d) => d.embedding));
  }
  return vectors;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
