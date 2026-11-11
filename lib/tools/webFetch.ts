import { extractTextFromBuffer } from "@/lib/files/extract";
import { buildDocumentIndex, INLINE_CHAR_LIMIT } from "@/lib/files/documentIndex";

// Many sites (especially financial/news sites) block or rate-limit requests
// from an obvious bot User-Agent, returning a 403/503 instead of the page.
// A real browser UA avoids that in most cases.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// A linked document (report, filing, deck, spreadsheet, scanned image) is
// extremely common to be asked to read — handle each the same way an
// uploaded file of that type is handled, instead of only supporting PDF and
// erroring out on everything else with "Unsupported content type".
const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
};
const KNOWN_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".pptx",
  ".xlsx",
  ".xls",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
]);

async function fetchOnce(url: string) {
  // A 10s cap was too tight for a larger PDF/report over a slow connection —
  // a 10-second abort surfaced to the user as a generic "operation was
  // aborted due to timeout" with no indication it was just a slow download.
  return fetch(url, { signal: AbortSignal.timeout(20000), headers: BROWSER_HEADERS });
}

function pickFileName(pathname: string, contentType: string): string {
  const urlExt = (pathname.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? "").toLowerCase();
  const ext = KNOWN_EXTENSIONS.has(urlExt) ? urlExt : (CONTENT_TYPE_EXTENSIONS[contentType] ?? "");
  const base = pathname.split("/").filter(Boolean).pop() || "file";
  return ext && !base.toLowerCase().endsWith(ext) ? `${base}${ext}` : base;
}

export async function webFetch(url: string) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { error: "Only http(s) URLs can be fetched." };
    }

    let res = await fetchOnce(parsed.toString());
    // A single retry handles transient 5xx errors/rate limiting without
    // giving up on a source the agent specifically picked.
    if (!res.ok && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 800));
      res = await fetchOnce(parsed.toString());
    }

    if (!res.ok) {
      return { error: `Fetch failed: ${res.status} ${res.statusText}` };
    }

    const contentType = res.headers.get("content-type") ?? "";
    const fileName = pickFileName(parsed.pathname, contentType);
    const ext = (fileName.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? "").toLowerCase();

    let text: string;
    if (KNOWN_EXTENSIONS.has(ext)) {
      const buffer = Buffer.from(await res.arrayBuffer());
      const result = await extractTextFromBuffer(buffer, fileName);
      if (result.error) return { error: result.error };
      text = result.text;
    } else {
      if (!contentType.includes("text") && !contentType.includes("html")) {
        return { error: `Unsupported content type: ${contentType}` };
      }
      const html = await res.text();
      // A generous sanity cap, not a deliberate truncation point — anything
      // past this still goes through the same inline-vs-retrieval check
      // below, it just isn't realistic for a plain web page to exceed it.
      text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500000);
    }

    // Same decision as an uploaded file (see app/api/files/upload/route.ts):
    // short enough to inline directly, or long enough that it needs to be
    // chunked+embedded and read via search_document instead of truncated.
    if (text.length > INLINE_CHAR_LIMIT) {
      const fileId = crypto.randomUUID();
      await buildDocumentIndex(fileId, fileName, text);
      return {
        url: parsed.toString(),
        fileId,
        needsRetrieval: true,
        fullLength: text.length,
        preview: text.slice(0, 2000),
        note: `This is ${text.length.toLocaleString()} characters long — use the search_document tool with this fileId and a focused query to find what's actually relevant instead of relying on the preview alone.`,
      };
    }
    return { url: parsed.toString(), text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
