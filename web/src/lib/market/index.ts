/**
 * Public market-data surface. The UI imports from here, never from
 * coinbase-* directly, so swapping providers later is a one-file change.
 */

export type {
  Candle,
  Granularity,
  OrderBook,
  OrderBookLevel,
  ProductId,
  Ticker,
  Trade,
} from "./types";

export {
  SYMBOLS,
  formatPrice,
  getSymbol,
  isSupported,
} from "./symbols";
export type { SymbolInfo } from "./symbols";

export {
  get24hStats,
  getCandles,
  getOrderBook,
  getRecentTrades,
  getTicker,
} from "./coinbase-rest";
export type { MarketStats } from "./coinbase-rest";

export {
  subscribeLevel2,
  subscribeTicker,
  subscribeTrades,
} from "./coinbase-ws";
export type { Level2Event, Level2Snapshot, Level2Update } from "./coinbase-ws";
