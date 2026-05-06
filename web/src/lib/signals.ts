/**
 * Client-side signal fetching with localStorage TTL cache.
 *
 * Why a cache: the dashboard re-renders on every WS tick (~30/s on a
 * busy symbol), and we don't want to re-bill OpenAI on every render.
 * The cache key is the *symbol*, with a 5-minute TTL, so the AI Signals
 * card refreshes on its own schedule rather than tracking ticks 1:1.
 *
 * Cache invalidation paths:
 *   - 5-minute TTL expiry
 *   - User clicks the refresh button (component-level, calls fetchSignal
 *     with `bypassCache: true`)
 *   - localStorage is per-browser, so wiping cookies = fresh signals
 */

import type { ProductId } from "./market";

export type SignalAction = "long" | "short" | "neutral";

export interface TradingSignal {
  action:      SignalAction;
  confidence:  number;
  target:      number;
  stopLoss:    number;
  rationale:   string;
  generatedAt: number;       // unix ms
  model:       string;
  symbol:      ProductId;
  lastClose:   number;
  tokensIn:    number;
  tokensOut:   number;
}

export interface SignalSnapshot {
  symbol:     ProductId;
  lastClose:  number;
  ema12:      number | null;
  rsi:        number | null;
  macd:       number | null;
  macdSignal: number | null;
  bbU:        number | null;
  bbL:        number | null;
}

const CACHE_PREFIX  = "ait:signal:";
const HISTORY_KEY   = "ait:signal:history";
const HISTORY_MAX   = 100;
const TTL_MS        = 5 * 60 * 1000;

function cacheKey(symbol: ProductId): string {
  return CACHE_PREFIX + symbol;
}

export function readCachedSignal(symbol: ProductId): TradingSignal | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(symbol));
    if (!raw) return null;
    const sig = JSON.parse(raw) as TradingSignal;
    if (!sig.generatedAt || Date.now() - sig.generatedAt > TTL_MS) {
      localStorage.removeItem(cacheKey(symbol));
      return null;
    }
    return sig;
  } catch {
    return null;
  }
}

function writeCache(sig: TradingSignal): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(cacheKey(sig.symbol), JSON.stringify(sig));
  } catch {
    // Quota or disabled storage — silently ignore. Cache is a perf hint, not correctness.
  }
  pushSignalHistory(sig);
}

// ─── Signal history (append-only timeline) ────────────────────────

const historyListeners = new Set<() => void>();
let cachedHistory: TradingSignal[] | null = null;

export function loadSignalHistory(): TradingSignal[] {
  if (cachedHistory) return cachedHistory;
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    cachedHistory = raw ? (JSON.parse(raw) as TradingSignal[]) : [];
  } catch {
    cachedHistory = [];
  }
  return cachedHistory;
}

function pushSignalHistory(sig: TradingSignal): void {
  const list = loadSignalHistory().slice();
  // Drop a same-symbol duplicate if its generatedAt matches (cache replays).
  const idx = list.findIndex((s) => s.symbol === sig.symbol && s.generatedAt === sig.generatedAt);
  if (idx >= 0) list.splice(idx, 1);
  list.unshift(sig);
  if (list.length > HISTORY_MAX) list.length = HISTORY_MAX;
  cachedHistory = list;
  if (typeof localStorage !== "undefined") {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch { /* quota */ }
  }
  for (const fn of historyListeners) fn();
}

export function clearSignalHistory(): void {
  cachedHistory = [];
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(HISTORY_KEY);
  }
  for (const fn of historyListeners) fn();
}

export function subscribeSignalHistory(fn: () => void): () => void {
  historyListeners.add(fn);
  return () => { historyListeners.delete(fn); };
}

export interface FetchOptions {
  bypassCache?: boolean;
  signal?:      AbortSignal;
}

/** Fetch a signal, hitting the cache first unless bypassed. */
export async function fetchSignal(
  snap: SignalSnapshot,
  opts: FetchOptions = {},
): Promise<TradingSignal> {
  if (!opts.bypassCache) {
    const cached = readCachedSignal(snap.symbol);
    if (cached) return cached;
  }

  const res = await fetch("/api/signals", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(snap),
    signal:  opts.signal,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch { /* not JSON */ }
    throw new Error(`signal request failed: ${res.status} ${detail}`);
  }
  const sig = (await res.json()) as TradingSignal;
  writeCache(sig);
  return sig;
}
