/**
 * Provider-agnostic market data types. The Coinbase adapter normalizes
 * responses into these shapes so the UI never sees "BTC-USD vs BTCUSDT"
 * formatting differences or descending-vs-ascending ordering quirks.
 */

export type ProductId = string; // e.g. "BTC-USD"

export type Granularity = 60 | 300 | 900 | 3600 | 21600 | 86400;

/** OHLCV bar. Times are unix seconds (lightweight-charts native). */
export interface Candle {
  time:   number;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface OrderBookLevel {
  price:    number;
  quantity: number;
}

export interface OrderBook {
  bids: OrderBookLevel[]; // descending by price (best first)
  asks: OrderBookLevel[]; // ascending  by price (best first)
}

export interface Trade {
  id:           number;
  price:        number;
  size:         number;
  time:         number;   // unix ms
  side:         "buy" | "sell"; // taker side
}

export interface Ticker {
  productId: ProductId;
  bid:       number;
  ask:       number;
  last:      number;
  volume24h: number;
  time:      number; // unix ms
}
