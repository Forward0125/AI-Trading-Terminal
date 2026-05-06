"use client";

/**
 * Live ticker for a Coinbase product. REST seed (so we have a price
 * within ~200ms of mount) + WS updates. Used for paper-trading P/L
 * calc, the modal's "current price" hint, and anywhere we need a
 * single up-to-date last price.
 */

import { useEffect, useState } from "react";
import {
  type ProductId,
  type Ticker,
  getTicker,
  subscribeTicker,
} from "@/lib/market";

export function useTicker(productId: ProductId): Ticker | null {
  const [ticker, setTicker] = useState<Ticker | null>(null);

  useEffect(() => {
    let alive = true;
    setTicker(null);

    getTicker(productId)
      .then((t) => { if (alive) setTicker(t); })
      .catch((err) => console.error("[useTicker] seed failed", err));

    const unsub = subscribeTicker(productId, (t) => {
      if (alive) setTicker(t);
    });

    return () => { alive = false; unsub(); };
  }, [productId]);

  return ticker;
}
