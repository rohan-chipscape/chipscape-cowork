const YAHOO_HEADERS = { "User-Agent": "Mozilla/5.0" };

type YahooSearchQuote = {
  symbol: string;
  quoteType: string;
  shortname?: string;
  longname?: string;
  exchDisp?: string;
};

/**
 * Exact, exchange-sourced stock data via Yahoo Finance's public (unauthenticated)
 * endpoints — the same kind of live market feed a brokerage app like Groww pulls
 * from, instead of a generic web search snippet that can be stale or mismatched
 * to the wrong company.
 */
export async function getStockQuote(query: string) {
  try {
    const searchRes = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}`,
      { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(8000) }
    );
    if (!searchRes.ok) {
      return { error: `Ticker lookup failed: ${searchRes.status} ${searchRes.statusText}` };
    }
    const searchData = await searchRes.json();
    const match: YahooSearchQuote | undefined = (searchData.quotes ?? []).find(
      (q: YahooSearchQuote) => q.quoteType === "EQUITY"
    );
    if (!match) {
      return { error: `Couldn't find a publicly traded stock matching "${query}".` };
    }

    const chartRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${match.symbol}?interval=1d&range=5d`,
      { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(8000) }
    );
    if (!chartRes.ok) {
      return { error: `Quote lookup failed: ${chartRes.status} ${chartRes.statusText}` };
    }
    const chartData = await chartRes.json();
    const result = chartData.chart?.result?.[0];
    if (!result) {
      return { error: `No price data available for ${match.symbol}.` };
    }

    const meta = result.meta ?? {};
    const quotes = result.indicators?.quote?.[0] ?? {};
    const timestamps: number[] = result.timestamp ?? [];

    const recentDays = timestamps.map((t, i) => ({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      open: quotes.open?.[i] ?? null,
      high: quotes.high?.[i] ?? null,
      low: quotes.low?.[i] ?? null,
      close: quotes.close?.[i] ?? null,
    }));

    return {
      symbol: match.symbol,
      companyName: match.longname ?? match.shortname ?? query,
      exchange: meta.fullExchangeName ?? match.exchDisp,
      currency: meta.currency,
      currentPrice: meta.regularMarketPrice,
      previousClose: meta.chartPreviousClose,
      dayHigh: meta.regularMarketDayHigh,
      dayLow: meta.regularMarketDayLow,
      changePercent: meta.regularMarketChangePercent,
      asOf: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : undefined,
      recentDays,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
