import fs from "node:fs";
import path from "node:path";
import { chunkText } from "./chunking";
import { cosineSimilarity, embedTexts } from "./embeddings";

const DIR = path.join(process.cwd(), ".data", "doc-index");

// A document longer than this doesn't get pasted into a prompt directly —
// it gets chunked+embedded instead, and read via the search_document tool.
// Shared by both the upload route and web_fetch so a document behaves the
// same way whether it arrived as an upload or a fetched URL.
export const INLINE_CHAR_LIMIT = 12000;

type DocumentChunk = { text: string; embedding: number[] };
type DocumentIndexFile = { fileName: string; chunks: DocumentChunk[] };

function ensureDir() {
  fs.mkdirSync(DIR, { recursive: true });
}

function filePath(fileId: string) {
  return path.join(DIR, `${fileId}.json`);
}

// Builds and persists the searchable index for one uploaded document — only
// called for documents long enough that the full text can't just be inlined
// into a prompt (see app/api/files/upload/route.ts).
export async function buildDocumentIndex(
  fileId: string,
  fileName: string,
  fullText: string
): Promise<void> {
  const chunkTexts = chunkText(fullText);
  const embeddings = await embedTexts(chunkTexts);
  const chunks: DocumentChunk[] = chunkTexts.map((text, i) => ({ text, embedding: embeddings[i] }));
  ensureDir();
  const data: DocumentIndexFile = { fileName, chunks };
  fs.writeFileSync(filePath(fileId), JSON.stringify(data));
}

export async function searchDocumentIndex(
  fileId: string,
  query: string,
  topK = 6
): Promise<{ fileName: string; results: string[] } | { error: string }> {
  let data: DocumentIndexFile;
  try {
    data = JSON.parse(fs.readFileSync(filePath(fileId), "utf-8"));
  } catch {
    return { error: `No document found for fileId "${fileId}". It may not have been indexed, or the id is wrong.` };
  }

  const [queryEmbedding] = await embedTexts([query]);
  const scored = data.chunks
    .map((c) => ({ text: c.text, score: cosineSimilarity(queryEmbedding, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return { fileName: data.fileName, results: scored.map((s) => s.text) };
}
