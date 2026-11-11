// Tavily's "content" is a raw scraped excerpt of the page, which often
// carries Markdown artifacts (heading hashes, bold/italic markers, link
// brackets) from the source HTML. Strip those so the snippet reads as plain
// text instead of leaking "### Heading" or "**bold**" into the UI.
function cleanSnippet(text: string): string {
  return text
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export async function webSearch(query: string) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return {
      error:
        "Web search isn't configured yet (missing TAVILY_API_KEY). You can still fetch a specific URL with web_fetch, or answer from what you already know.",
    };
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 8,
        search_depth: "advanced",
        // Tavily does its own page rendering/extraction server-side, which
        // handles JS-heavy pages our own web_fetch can't (it's a plain HTTP
        // fetch with no JS execution). Pulling the fuller extracted content
        // here means the model often doesn't need a separate web_fetch call
        // at all, and include_answer gives a RAG-tuned synthesized answer
        // from the top sources as an extra signal.
        include_raw_content: true,
        include_answer: true,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return { error: `Search failed: ${res.status} ${await res.text()}` };
    }

    const data = await res.json();
    const results = (data.results ?? []).map((r: any) => ({
      title: r.title,
      url: r.url,
      snippet: cleanSnippet(r.content ?? ""),
      content: r.raw_content ? cleanSnippet(r.raw_content).slice(0, 6000) : undefined,
    }));
    return {
      answer: data.answer ? cleanSnippet(data.answer) : undefined,
      results,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
