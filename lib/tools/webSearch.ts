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
      snippet: r.content,
    }));
    return { results };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
