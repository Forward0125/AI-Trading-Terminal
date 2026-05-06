/**
 * Persists the most-recent backtest result so the Dashboard's
 * "Backtesting Insights" card can show stats without re-running.
 *
 * Single-slot store — only the latest result is kept, since this
 * is for "what did you last try?" not "history of every experiment".
 * Pub-sub mirrors lib/paper.ts so multiple components stay in sync.
 */

import type { BacktestResult } from "./backtester";
import type { Granularity, ProductId } from "./market";

const STORAGE_KEY = "ait:backtest:latest";

export interface StoredBacktest {
  productId:    ProductId;
  granularity:  Granularity;
  presetName:   string;
  result:       BacktestResult;
  ranAt:        number;
}

let cached: StoredBacktest | null | undefined = undefined;
const listeners = new Set<() => void>();

export function loadBacktest(): StoredBacktest | null {
  if (cached !== undefined) return cached;
  if (typeof localStorage === "undefined") {
    cached = null;
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cached = raw ? (JSON.parse(raw) as StoredBacktest) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function saveBacktest(b: StoredBacktest): void {
  cached = b;
  if (typeof localStorage !== "undefined") {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(b)); } catch { /* quota */ }
  }
  for (const fn of listeners) fn();
}

export function subscribeBacktest(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
