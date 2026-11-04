// Many sites (especially financial/news sites) block or rate-limit requests
// from an obvious bot User-Agent, returning a 403/503 instead of the page.
// A real browser UA avoids that in most cases.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchOnce(url: string) {
  return fetch(url, { signal: AbortSignal.timeout(10000), headers: BROWSER_HEADERS });
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
    if (!contentType.includes("text") && !contentType.includes("html")) {
      return { error: `Unsupported content type: ${contentType}` };
    }

    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);

    return { url: parsed.toString(), text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
