/**
 * GET /api/stocks/{symbol}/klines?range=1y&interval=1d
 *
 * Server-side proxy to Yahoo Finance's v8 chart endpoint. Yahoo
 * blocks browser CORS, so we fetch from a Vercel route instead and
 * normalize the response into the same Candle[] shape the Coinbase
 * REST client returns.
 *
 * Whitelist enforced: an open proxy here would let anyone use this
 * route as a free Yahoo proxy (against their TOS, and reflects on
 * the deploy's reputation). Pinning to a few well-known tickers
 * keeps the surface tight.
 */

const ALLOWED_SYMBOLS = new Set(["AAPL", "SPY", "TSLA", "MSFT", "GOOGL", "NVDA", "AMZN", "META"]);
const ALLOWED_INTERVAL = new Set(["1m", "5m", "15m", "1h", "1d", "1wk", "1mo"]);
const ALLOWED_RANGE    = new Set(["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]);

interface YahooQuote {
  open:   (number | null)[];
  high:   (number | null)[];
  low:    (number | null)[];
  close:  (number | null)[];
  volume: (number | null)[];
}

interface YahooResult {
  meta:       { regularMarketPrice?: number; symbol?: string };
  timestamp:  number[];
  indicators: { quote: YahooQuote[] };
}

interface YahooResponse {
  chart: { result?: YahooResult[]; error?: { description: string } | null };
}

interface Candle {
  time:   number;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export async function GET(
  req:    Request,
  ctx:    { params: Promise<{ symbol: string }> },
): Promise<Response> {
  const { symbol } = await ctx.params;
  const upper = (symbol ?? "").toUpperCase();
  if (!ALLOWED_SYMBOLS.has(upper)) {
    return Response.json(
      { error: `symbol not in allow-list: ${upper}` },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const interval = url.searchParams.get("interval") ?? "1d";
  const range    = url.searchParams.get("range")    ?? "1y";
  if (!ALLOWED_INTERVAL.has(interval)) {
    return Response.json({ error: `bad interval: ${interval}` }, { status: 400 });
  }
  if (!ALLOWED_RANGE.has(range)) {
    return Response.json({ error: `bad range: ${range}` }, { status: 400 });
  }

  const yahooUrl =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(upper)}` +
    `?interval=${interval}&range=${range}&includePrePost=false`;

  const res = await fetch(yahooUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AI-Trading-Terminal/1.0)" },
    cache:   "no-store",
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    return Response.json(
      { error: `yahoo ${res.status}: ${detail}` },
      { status: 502 },
    );
  }

  const json = (await res.json()) as YahooResponse;

  if (json.chart.error || !json.chart.result?.[0]) {
    return Response.json(
      { error: json.chart.error?.description ?? "no result for symbol" },
      { status: 502 },
    );
  }

  const r          = json.chart.result[0];
  const timestamps = r.timestamp;
  const q          = r.indicators.quote[0];

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = q.open[i];
    const h = q.high[i];
    const l = q.low[i];
    const c = q.close[i];
    const v = q.volume[i];
    // Skip rows where any OHLC is null (Yahoo returns nulls for
    // half-day holidays, etc.) — the chart libs choke otherwise.
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({ time: timestamps[i], open: o, high: h, low: l, close: c, volume: v ?? 0 });
  }

  return Response.json({
    symbol:    upper,
    interval,
    range,
    candles,
    fetchedAt: Date.now(),
  });
}
