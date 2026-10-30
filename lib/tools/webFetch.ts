export async function webFetch(url: string) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { error: "Only http(s) URLs can be fetched." };
    }

    const res = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Cowork-Agent/1.0" },
    });

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
