"use client";

import { useSyncExternalStore } from "react";
import { loadAccount, subscribeAccount, type PaperAccount } from "@/lib/paper";

const SSR_FALLBACK: PaperAccount = {
  version:      1,
  startingCash: 100_000,
  cash:         100_000,
  positions:    [],
  orderHistory: [],
  realizedPnL:  0,
  createdAt:    0,
};

/** Subscribes to the paper-trading store. Mutations live in
 *  `lib/paper.ts` (placeOrder, resetAccount); the hook is read-only. */
export function usePaperAccount(): PaperAccount {
  return useSyncExternalStore(
    subscribeAccount,
    loadAccount,
    () => SSR_FALLBACK,
  );
}
