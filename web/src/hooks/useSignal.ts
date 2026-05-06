"use client";

/**
 * useSignal — fetches an AI signal for the given snapshot, hitting the
 * 5-min localStorage cache first.
 *
 * Refresh policy:
 *   - On symbol change, refetch (after consulting cache).
 *   - When `snap.lastClose` changes, ignore — that would re-fetch on
 *     every WS tick. The 5-min cache is the throttle.
 *   - User can call `refresh()` to bypass cache (rate-limited at the UI
 *     level by a cooldown button in step 6).
 *
 * The hook depends only on `snap.symbol` for re-fetch. `snap` itself is
 * captured in a ref so the request always sends fresh indicator values.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchSignal,
  readCachedSignal,
  type SignalSnapshot,
  type TradingSignal,
} from "@/lib/signals";

interface UseSignalResult {
  signal:   TradingSignal | null;
  loading:  boolean;
  error:    string | null;
  refresh:  () => void;
}

export function useSignal(snap: SignalSnapshot | null): UseSignalResult {
  const [signal,  setSignal]  = useState<TradingSignal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const snapRef = useRef(snap);
  snapRef.current = snap;

  const run = useCallback(async (bypass: boolean) => {
    const s = snapRef.current;
    if (!s) return;
    setError(null);
    if (!bypass) {
      const cached = readCachedSignal(s.symbol);
      if (cached) {
        setSignal(cached);
        return;
      }
    }
    setLoading(true);
    try {
      const sig = await fetchSignal(s, { bypassCache: bypass });
      // Guard against a symbol switch while in flight: drop result if stale.
      if (snapRef.current?.symbol === s.symbol) setSignal(sig);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-evaluate whenever the symbol changes.
  useEffect(() => {
    if (snap?.symbol) void run(false);
  }, [snap?.symbol, run]);

  const refresh = useCallback(() => { void run(true); }, [run]);

  return { signal, loading, error, refresh };
}
