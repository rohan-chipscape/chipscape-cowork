// Splits long document text into overlapping chunks small enough to embed
// and compare individually. A sliding window on characters (not trying to
// respect sentence/paragraph boundaries precisely) is simple and good
// enough — the overlap means a fact split across a boundary still shows up
// whole in at least one chunk.
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;

export function chunkText(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= CHUNK_SIZE) return [trimmed];

  const chunks: string[] = [];
  let start = 0;
  while (start < trimmed.length) {
    const end = Math.min(start + CHUNK_SIZE, trimmed.length);
    chunks.push(trimmed.slice(start, end));
    if (end >= trimmed.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}
