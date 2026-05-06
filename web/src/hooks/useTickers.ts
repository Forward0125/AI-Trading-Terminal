"use client";

/**
 * Subscribe to live tickers for an arbitrary set of products.
 *
 * React's rules of hooks forbid calling useTicker in a loop, so this
 * batches all subscriptions inside a single effect. The Coinbase WS
 * singleton dedups internally, so subscribing 10 times to BTC-USD
 * still only sends one SUBSCRIBE frame on the wire.
 *
 * The dep key is the symbols joined with "|" so the effect re-runs
 * only when the set actually changes.
 */

import { useEffect, useState } from "react";
import {
  type ProductId,
  type Ticker,
  getTicker,
  subscribeTicker,
} from "@/lib/market";

export function useTickers(productIds: ProductId[]): Map<ProductId, Ticker> {
  const [tickers, setTickers] = useState<Map<ProductId, Ticker>>(new Map());
  const key = productIds.slice().sort().join("|");

  useEffect(() => {
    if (productIds.length === 0) {
      setTickers(new Map());
      return;
    }

    const local = new Map<ProductId, Ticker>();
    let alive = true;

    function flush(): void {
      if (alive) setTickers(new Map(local));
    }

    const unsubs = productIds.map((id) => {
      getTicker(id)
        .then((t) => { local.set(id, t); flush(); })
        .catch(() => { /* fall through to WS */ });

      return subscribeTicker(id, (t) => {
        local.set(id, t);
        flush();
      });
    });

    return () => {
      alive = false;
      for (const u of unsubs) u();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return tickers;
}
