"use client";

/**
 * Live candles for a Coinbase product. Seeds with REST history, then
 * synthesizes 1-minute (or any granularity) bars from the trade tape.
 *
 * Coinbase has no native kline stream, so this hook is the source of
 * truth for the chart's OHLCV data. The aggregator:
 *
 *   - bucket = floor(trade.time / granularity) * granularity
 *   - if bucket matches the last bar -> update high/low/close/volume
 *   - if bucket is newer            -> append a new bar
 *   - if bucket is older (rare, out-of-order) -> drop silently
 *
 * The hook also exposes a setter for the symbol and re-fetches/resubs
 * when it changes. Cleanup unsubscribes the WS handler.
 */

import { useEffect, useRef, useState } from "react";
import {
  type Candle,
  type Granularity,
  type ProductId,
  getCandles,
  subscribeTrades,
} from "@/lib/market";

export interface UseCandlesResult {
  candles:    Candle[];
  loading:    boolean;
  lastUpdate: number;     // unix ms; bumps on every live tick
}

export function useCandles(
  productId:      ProductId,
  granularitySec: Granularity = 60,
): UseCandlesResult {
  const [candles,    setCandles]    = useState<Candle[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [lastUpdate, setLastUpdate] = useState(0);
  const candlesRef = useRef<Candle[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    getCandles(productId, granularitySec)
      .then((seed) => {
        if (!alive) return;
        candlesRef.current = seed;
        setCandles(seed);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[useCandles] seed failed", err);
        if (alive) setLoading(false);
      });

    const unsub = subscribeTrades(productId, (trade) => {
      const cs = candlesRef.current;
      if (cs.length === 0) return;

      const last   = cs[cs.length - 1];
      const bucket = Math.floor(trade.time / 1000 / granularitySec) * granularitySec;

      let next: Candle[];
      if (bucket === last.time) {
        next = cs.slice(0, -1).concat({
          ...last,
          high:   Math.max(last.high, trade.price),
          low:    Math.min(last.low,  trade.price),
          close:  trade.price,
          volume: last.volume + trade.size,
        });
      } else if (bucket > last.time) {
        next = cs.concat({
          time:   bucket,
          open:   trade.price,
          high:   trade.price,
          low:    trade.price,
          close:  trade.price,
          volume: trade.size,
        });
      } else {
        return; // out-of-order tape entry; ignore
      }
      candlesRef.current = next;
      setCandles(next);
      setLastUpdate(Date.now());
    });

    return () => { alive = false; unsub(); };
  }, [productId, granularitySec]);

  return { candles, loading, lastUpdate };
}
