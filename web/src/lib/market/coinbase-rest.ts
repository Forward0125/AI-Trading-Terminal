/**
 * Coinbase Exchange public REST client.
 *
 * Base: https://api.exchange.coinbase.com
 * No API key required for these endpoints.
 *
 * Coinbase quirks the UI never has to see:
 *   - candles return descending by time (we reverse to ascending)
 *   - candle rows are tuples: [time, low, high, open, close, volume]
 *   - order-book rows are [price, qty, num_orders] strings
 *   - prices/sizes come back as strings, not numbers
 */

import type { Candle, Granularity, OrderBook, ProductId, Ticker, Trade } from "./types";

const BASE = "https://api.exchange.coinbase.com";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`coinbase ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

type CoinbaseCandleTuple = [number, number, number, number, number, number];

/** Fetch up to 300 historical OHLCV bars. Default granularity 60s = 1 minute.
 *  Coinbase caps the response at 300 rows; for longer windows raise the
 *  granularity rather than paging. */
export async function getCandles(
  productId: ProductId,
  granularity: Granularity = 60,
): Promise<Candle[]> {
  const rows = await getJson<CoinbaseCandleTuple[]>(
    `/products/${productId}/candles?granularity=${granularity}`,
  );
  // Coinbase returns descending; we want ascending so the chart appends
  // new bars on the right.
  return rows
    .slice()
    .reverse()
    .map(([time, low, high, open, close, volume]) => ({
      time, open, high, low, close, volume,
    }));
}

interface CoinbaseBookResponse {
  bids: [string, string, number][];
  asks: [string, string, number][];
}

/** Initial depth snapshot, sliced to top `levels` rows per side.
 *
 *  Coinbase's `level=2` endpoint returns the full aggregated book (often
 *  20k+ rows), which is wasteful for the dashboard's top-of-book panel.
 *  We fetch once and trim. Live updates flow through the level2_batch
 *  WS channel afterward. */
export async function getOrderBook(
  productId: ProductId,
  levels = 50,
): Promise<OrderBook> {
  const data = await getJson<CoinbaseBookResponse>(
    `/products/${productId}/book?level=2`,
  );
  return {
    bids: data.bids.slice(0, levels).map(([p, q]) => ({ price: +p, quantity: +q })),
    asks: data.asks.slice(0, levels).map(([p, q]) => ({ price: +p, quantity: +q })),
  };
}

interface CoinbaseTickerResponse {
  ask:       string;
  bid:       string;
  volume:    string;
  trade_id:  number;
  price:     string;
  size:      string;
  time:      string; // ISO
}

export async function getTicker(productId: ProductId): Promise<Ticker> {
  const t = await getJson<CoinbaseTickerResponse>(`/products/${productId}/ticker`);
  return {
    productId,
    bid:       +t.bid,
    ask:       +t.ask,
    last:      +t.price,
    volume24h: +t.volume,
    time:      Date.parse(t.time),
  };
}

interface CoinbaseStatsResponse {
  open:    string;
  high:    string;
  low:     string;
  last:    string;
  volume:  string;
}

export interface MarketStats {
  open:      number;
  high:      number;
  low:       number;
  last:      number;
  volume:    number;
  change:    number;   // last - open
  changePct: number;   // (last - open) / open
}

/** 24-hour rolling stats. One REST call instead of inferring from
 *  a candle window — the headline %-change badge needs this. */
export async function get24hStats(productId: ProductId): Promise<MarketStats> {
  const s = await getJson<CoinbaseStatsResponse>(`/products/${productId}/stats`);
  const open = +s.open;
  const last = +s.last;
  const change = last - open;
  return {
    open,
    high:      +s.high,
    low:       +s.low,
    last,
    volume:    +s.volume,
    change,
    changePct: open > 0 ? change / open : 0,
  };
}

interface CoinbaseTradeResponse {
  time:     string;  // ISO
  trade_id: number;
  price:    string;
  size:     string;
  side:     "buy" | "sell";
}

/** Recent trade tape (default 100, max 1000). Useful for seeding the
 *  Trade History panel before the WS feed catches up. */
export async function getRecentTrades(
  productId: ProductId,
  limit = 100,
): Promise<Trade[]> {
  const rows = await getJson<CoinbaseTradeResponse[]>(
    `/products/${productId}/trades?limit=${limit}`,
  );
  return rows.map((r) => ({
    id:    r.trade_id,
    price: +r.price,
    size:  +r.size,
    time:  Date.parse(r.time),
    side:  r.side,
  }));
}
