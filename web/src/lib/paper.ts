/**
 * Paper-trading account state, persisted to localStorage.
 *
 * Design:
 *   - One global PaperAccount object keyed under "ait:paper:account".
 *   - Pub-sub via a Set of listeners so multiple components stay in
 *     sync without prop-drilling. Used by useSyncExternalStore in the
 *     hook so React 18+ subscribes natively.
 *   - Long-only for the MVP: shorts would need margin tracking we
 *     don't have. Sells are capped at the open position's qty.
 *   - Market orders only. The submitted price is whatever the latest
 *     ticker shows at submit time; limit orders need a server-side
 *     watcher we're not building.
 *
 * Cash math:
 *   - BUY  : cash -= qty * price; position avg_price = weighted average.
 *   - SELL : cash += qty * price; realised P/L  = qty * (price - avg);
 *            avg_price stays the same on partial closes.
 *   - Reset wipes everything back to the starting cash.
 *
 * Schema version: 1. Bump if the shape changes; the loader migrates
 *                    or resets on mismatch.
 */

import type { ProductId } from "./market";

const STORAGE_KEY     = "ait:paper:account";
const STARTING_CASH   = 100_000;
const SCHEMA_VERSION  = 1;

export interface Position {
  symbol:    ProductId;
  qty:       number;
  avgPrice:  number;
  openedAt:  number;
}

export type OrderSide = "buy" | "sell";

export interface OrderRecord {
  id:           string;
  symbol:       ProductId;
  side:         OrderSide;
  qty:          number;
  price:        number;
  notional:     number;
  filledAt:     number;
  realizedPnL?: number;   // sells only
}

export interface PaperAccount {
  version:       typeof SCHEMA_VERSION;
  startingCash:  number;
  cash:          number;
  positions:     Position[];
  orderHistory:  OrderRecord[];
  realizedPnL:   number;
  createdAt:     number;
}

export interface PlaceOrderParams {
  symbol: ProductId;
  side:   OrderSide;
  qty:    number;
  price:  number;       // current ticker price at submit time
}

export interface PlaceOrderResult {
  ok:     true;
  order:  OrderRecord;
  account: PaperAccount;
}

export interface PlaceOrderError {
  ok:     false;
  error:  string;
}

// ─── Internal cache + pub/sub ─────────────────────────────────────

let cached: PaperAccount | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

function defaultAccount(): PaperAccount {
  return {
    version:       SCHEMA_VERSION,
    startingCash:  STARTING_CASH,
    cash:          STARTING_CASH,
    positions:     [],
    orderHistory:  [],
    realizedPnL:   0,
    createdAt:     Date.now(),
  };
}

function readStorage(): PaperAccount {
  if (typeof localStorage === "undefined") return defaultAccount();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAccount();
    const parsed = JSON.parse(raw) as PaperAccount;
    // Version mismatch -> wipe rather than risk corrupted state.
    if (parsed.version !== SCHEMA_VERSION) return defaultAccount();
    return parsed;
  } catch {
    return defaultAccount();
  }
}

function writeStorage(account: PaperAccount): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
  } catch {
    // Quota / disabled — caller's mutation still wins in-memory.
  }
}

// ─── Public surface ───────────────────────────────────────────────

export function loadAccount(): PaperAccount {
  if (!cached) cached = readStorage();
  return cached;
}

export function subscribeAccount(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function commit(next: PaperAccount): void {
  cached = next;
  writeStorage(next);
  notify();
}

export function placeOrder(p: PlaceOrderParams): PlaceOrderResult | PlaceOrderError {
  if (!Number.isFinite(p.qty) || p.qty <= 0) {
    return { ok: false, error: "quantity must be positive" };
  }
  if (!Number.isFinite(p.price) || p.price <= 0) {
    return { ok: false, error: "no live price for this symbol — wait a second and retry" };
  }

  const acc = loadAccount();
  const notional = p.qty * p.price;

  if (p.side === "buy") {
    if (acc.cash < notional) {
      return {
        ok: false,
        error: `insufficient cash: need ${formatUSD(notional)}, have ${formatUSD(acc.cash)}`,
      };
    }
  } else {
    const existing = acc.positions.find((pos) => pos.symbol === p.symbol);
    if (!existing || existing.qty < p.qty) {
      return {
        ok:    false,
        error: `cannot sell ${p.qty} ${p.symbol} — only ${existing?.qty ?? 0} held`,
      };
    }
  }

  const next: PaperAccount = {
    ...acc,
    positions:    acc.positions.map((x) => ({ ...x })),
    orderHistory: acc.orderHistory.slice(),
  };

  let realizedPnLForOrder: number | undefined = undefined;

  if (p.side === "buy") {
    next.cash -= notional;
    const idx = next.positions.findIndex((pos) => pos.symbol === p.symbol);
    if (idx === -1) {
      next.positions.push({
        symbol:   p.symbol,
        qty:      p.qty,
        avgPrice: p.price,
        openedAt: Date.now(),
      });
    } else {
      const pos = next.positions[idx];
      const newQty   = pos.qty + p.qty;
      const newAvg   = (pos.qty * pos.avgPrice + p.qty * p.price) / newQty;
      next.positions[idx] = { ...pos, qty: newQty, avgPrice: newAvg };
    }
  } else {
    next.cash += notional;
    const idx = next.positions.findIndex((pos) => pos.symbol === p.symbol);
    const pos = next.positions[idx];
    realizedPnLForOrder = p.qty * (p.price - pos.avgPrice);
    next.realizedPnL += realizedPnLForOrder;
    const remaining = pos.qty - p.qty;
    if (remaining < 1e-12) {
      next.positions.splice(idx, 1);
    } else {
      next.positions[idx] = { ...pos, qty: remaining };
    }
  }

  const order: OrderRecord = {
    id:          newId(),
    symbol:      p.symbol,
    side:        p.side,
    qty:         p.qty,
    price:       p.price,
    notional,
    filledAt:    Date.now(),
    realizedPnL: realizedPnLForOrder,
  };
  next.orderHistory.unshift(order);
  // Keep history bounded so localStorage doesn't grow forever.
  if (next.orderHistory.length > 500) next.orderHistory.length = 500;

  commit(next);
  return { ok: true, order, account: next };
}

export function resetAccount(): PaperAccount {
  const fresh = defaultAccount();
  commit(fresh);
  return fresh;
}

// ─── Helpers ──────────────────────────────────────────────────────

function newId(): string {
  // Cheap collision-resistant id; we don't need crypto-strength.
  return `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatUSD(n: number): string {
  return n.toLocaleString(undefined, {
    style:                 "currency",
    currency:              "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
