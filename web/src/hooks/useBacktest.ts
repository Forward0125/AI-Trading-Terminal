"use client";

import { useSyncExternalStore } from "react";
import {
  loadBacktest,
  subscribeBacktest,
  type StoredBacktest,
} from "@/lib/backtest-store";

/** Read-only subscription to the most-recent backtest. Mutations
 *  go through saveBacktest() in lib/backtest-store.ts. */
export function useBacktest(): StoredBacktest | null {
  return useSyncExternalStore(
    subscribeBacktest,
    loadBacktest,
    () => null,   // SSR fallback
  );
}
