/**
 * Coinbase Exchange public WebSocket client.
 *
 * Endpoint: wss://ws-feed.exchange.coinbase.com
 * No auth required for the channels we use.
 *
 * Design notes:
 *   - Single connection per browser tab, shared across all subscribers.
 *     Multiple components watching BTC-USD share one socket.
 *   - Exponential backoff with jitter on disconnect (500ms .. 30s).
 *   - On reconnect, all currently-active subscriptions are re-issued.
 *   - Stale-message watchdog: if no frame in 30s, force-reconnect.
 *     Coinbase normally pushes ticker updates much more often than that.
 *   - SSR-safe: the singleton is only created on the client (lazy).
 */

import type { OrderBookLevel, ProductId, Ticker, Trade } from "./types";

type Channel = "ticker" | "matches" | "level2_batch";
type Unsubscribe = () => void;

interface TickerMessage {
  type:       "ticker";
  product_id: ProductId;
  price:      string;
  best_bid:   string;
  best_ask:   string;
  volume_24h: string;
  time:       string;
}

interface MatchMessage {
  type:       "match" | "last_match";
  trade_id:   number;
  product_id: ProductId;
  price:      string;
  size:       string;
  side:       "buy" | "sell";
  time:       string;
}

/** Coinbase initially sends a `snapshot` for level2_batch, then `l2update`s. */
interface L2SnapshotMessage {
  type:       "snapshot";
  product_id: ProductId;
  bids:       [string, string][];
  asks:       [string, string][];
}

interface L2UpdateMessage {
  type:       "l2update";
  product_id: ProductId;
  changes:    ["buy" | "sell", string, string][]; // [side, price, new_size]; new_size="0" means remove
  time:       string;
}

export type Level2Message = L2SnapshotMessage | L2UpdateMessage;

const URL_ = "wss://ws-feed.exchange.coinbase.com";
const BACKOFF_MS = [500, 1000, 2000, 4000, 8000, 15000, 30000];
const STALE_MS   = 30_000;

class CoinbaseWs {
  private ws: WebSocket | null = null;
  private state: "idle" | "connecting" | "open" | "reconnecting" | "closed" = "idle";
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private staleTimer:     ReturnType<typeof setTimeout> | null = null;

  // (channel, productId) -> set of handlers
  private subs = new Map<Channel, Map<ProductId, Set<(msg: unknown) => void>>>();

  /** Public: subscribe a handler. Returns the unsubscribe fn. Auto-connects
   *  on first call. */
  subscribe<T>(
    channel:   Channel,
    productId: ProductId,
    handler:   (msg: T) => void,
  ): Unsubscribe {
    let perChannel = this.subs.get(channel);
    if (!perChannel) {
      perChannel = new Map();
      this.subs.set(channel, perChannel);
    }
    let perProduct = perChannel.get(productId);
    const isFirstForProduct = !perProduct;
    if (!perProduct) {
      perProduct = new Set();
      perChannel.set(productId, perProduct);
    }
    perProduct.add(handler as (msg: unknown) => void);

    if (this.state === "idle" || this.state === "closed") {
      this.connect();
    } else if (this.state === "open" && isFirstForProduct) {
      this.send({ type: "subscribe", channels: [{ name: channel, product_ids: [productId] }] });
    }

    return () => this.unsubscribe(channel, productId, handler as (msg: unknown) => void);
  }

  private unsubscribe(
    channel:   Channel,
    productId: ProductId,
    handler:   (msg: unknown) => void,
  ): void {
    const perChannel = this.subs.get(channel);
    const perProduct = perChannel?.get(productId);
    if (!perProduct) return;
    perProduct.delete(handler);
    if (perProduct.size === 0) {
      perChannel!.delete(productId);
      if (this.state === "open") {
        this.send({ type: "unsubscribe", channels: [{ name: channel, product_ids: [productId] }] });
      }
    }
    if (perChannel!.size === 0) this.subs.delete(channel);

    // Last subscriber? Tear down the socket.
    if (this.subs.size === 0) this.shutdown();
  }

  private connect(): void {
    if (this.ws) return;

    this.state = this.attempt === 0 ? "connecting" : "reconnecting";
    const ws = new WebSocket(URL_);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.state = "open";
      this.attempt = 0;
      this.bumpStaleTimer();
      // Re-subscribe to everything currently registered.
      const channels = [...this.subs.entries()].flatMap(([name, perProduct]) => {
        const ids = [...perProduct.keys()];
        return ids.length ? [{ name, product_ids: ids }] : [];
      });
      if (channels.length) this.send({ type: "subscribe", channels });
    });

    ws.addEventListener("message", (ev) => {
      this.bumpStaleTimer();
      let parsed: { type?: string; product_id?: ProductId } & Record<string, unknown>;
      try { parsed = JSON.parse(ev.data as string); } catch { return; }

      // Skip server-side echoes / errors silently; the watchdog handles real failures.
      if (parsed.type === "subscriptions" || parsed.type === "error" || !parsed.type) return;

      const channel = mapTypeToChannel(parsed.type as string);
      if (!channel || !parsed.product_id) return;

      const handlers = this.subs.get(channel)?.get(parsed.product_id);
      if (!handlers) return;
      for (const h of handlers) h(parsed);
    });

    ws.addEventListener("close", () => this.handleDisconnect());
    ws.addEventListener("error", () => this.handleDisconnect());
  }

  private handleDisconnect(): void {
    if (this.staleTimer) { clearTimeout(this.staleTimer); this.staleTimer = null; }
    this.ws = null;
    if (this.subs.size === 0) {
      this.state = "closed";
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const idx   = Math.min(this.attempt, BACKOFF_MS.length - 1);
    const base  = BACKOFF_MS[idx];
    const delay = base * (0.5 + Math.random() * 0.5); // ±50% jitter
    this.attempt += 1;
    this.state    = "reconnecting";
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /** Coinbase doesn't enforce app-level pings. We use a watchdog: if no
   *  frame in 30s on an active subscription, the socket is probably dead. */
  private bumpStaleTimer(): void {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => {
      try { this.ws?.close(); } catch { /* swallow */ }
    }, STALE_MS);
  }

  private send(payload: unknown): void {
    try { this.ws?.send(JSON.stringify(payload)); } catch { /* dropped on reconnect */ }
  }

  private shutdown(): void {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.staleTimer)     { clearTimeout(this.staleTimer);     this.staleTimer     = null; }
    try { this.ws?.close(); } catch { /* swallow */ }
    this.ws    = null;
    this.state = "closed";
    this.attempt = 0;
  }
}

function mapTypeToChannel(type: string): Channel | null {
  switch (type) {
    case "ticker":        return "ticker";
    case "match":
    case "last_match":    return "matches";
    case "snapshot":
    case "l2update":      return "level2_batch";
    default:              return null;
  }
}

// ─── Singleton + typed public surface ─────────────────────────────

let singleton: CoinbaseWs | null = null;
function client(): CoinbaseWs {
  if (!singleton) singleton = new CoinbaseWs();
  return singleton;
}

export function subscribeTicker(
  productId: ProductId,
  handler:   (t: Ticker) => void,
): Unsubscribe {
  return client().subscribe<TickerMessage>("ticker", productId, (m) => {
    handler({
      productId,
      bid:       +m.best_bid,
      ask:       +m.best_ask,
      last:      +m.price,
      volume24h: +m.volume_24h,
      time:      Date.parse(m.time),
    });
  });
}

export function subscribeTrades(
  productId: ProductId,
  handler:   (t: Trade) => void,
): Unsubscribe {
  return client().subscribe<MatchMessage>("matches", productId, (m) => {
    handler({
      id:    m.trade_id,
      price: +m.price,
      size:  +m.size,
      time:  Date.parse(m.time),
      side:  m.side,
    });
  });
}

export interface Level2Snapshot {
  type: "snapshot";
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}
export interface Level2Update {
  type:    "update";
  changes: { side: "buy" | "sell"; level: OrderBookLevel }[];
}
export type Level2Event = Level2Snapshot | Level2Update;

export function subscribeLevel2(
  productId: ProductId,
  handler:   (ev: Level2Event) => void,
): Unsubscribe {
  return client().subscribe<Level2Message>("level2_batch", productId, (m) => {
    if (m.type === "snapshot") {
      handler({
        type: "snapshot",
        bids: m.bids.map(([p, q]) => ({ price: +p, quantity: +q })),
        asks: m.asks.map(([p, q]) => ({ price: +p, quantity: +q })),
      });
    } else {
      handler({
        type: "update",
        changes: m.changes.map(([side, p, q]) => ({
          side,
          level: { price: +p, quantity: +q },
        })),
      });
    }
  });
}
