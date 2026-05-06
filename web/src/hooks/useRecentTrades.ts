"use client";

/**
 * Recent trades feed (the tape).
 *
 * Seeded with `/products/{id}/trades?limit=N`, then prepended live
 * via the `matches` WS channel. Capped at `limit` so the array stays
 * bounded as ticks land.
 */

import { useEffect, useState } from "react";
import {
  type ProductId,
  type Trade,
  getRecentTrades,
  subscribeTrades,
} from "@/lib/market";

export function useRecentTrades(
  productId: ProductId,
  limit:     number = 30,
): Trade[] {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    let alive = true;
    setTrades([]);

    getRecentTrades(productId, limit)
      .then((seed) => { if (alive) setTrades(seed); })
      .catch((err) => console.error("[useRecentTrades] seed failed", err));

    const unsub = subscribeTrades(productId, (t) => {
      setTrades((prev) => {
        // Drop duplicates if REST seed already includes this trade id.
        if (prev.length > 0 && prev[0].id === t.id) return prev;
        const next = [t, ...prev];
        return next.length > limit ? next.slice(0, limit) : next;
      });
    });

    return () => { alive = false; unsub(); };
  }, [productId, limit]);

  return trades;
}
