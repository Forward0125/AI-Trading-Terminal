"use client";

import { useSyncExternalStore } from "react";
import {
  loadSignalHistory,
  subscribeSignalHistory,
  type TradingSignal,
} from "@/lib/signals";

const EMPTY: TradingSignal[] = [];

export function useSignalHistory(): TradingSignal[] {
  return useSyncExternalStore(
    subscribeSignalHistory,
    loadSignalHistory,
    () => EMPTY,
  );
}
