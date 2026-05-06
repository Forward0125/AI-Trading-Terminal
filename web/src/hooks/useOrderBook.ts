"use client";

/**
 * Live order book for a Coinbase product.
 *
 *   1. Seed with the REST `/products/{id}/book?level=2` snapshot (top 50
 *      per side after our trim in coinbase-rest.ts).
 *   2. Subscribe to the level2_batch WS channel and apply diffs:
 *        qty == 0  -> remove that price level
 *        qty != 0  -> set that price level
 *   3. After each update, slice top `levels` per side for the panel.
 *
 * The full per-side book lives in refs (Maps keyed by price); the
 * trimmed view is the React state that triggers renders. This avoids
 * O(n) array writes on every batch when the underlying book is large.
 */

import { useEffect, useRef, useState } from "react";
import {
  type OrderBook,
  type ProductId,
  getOrderBook,
  subscribeLevel2,
} from "@/lib/market";

export interface UseOrderBookResult {
  book:    OrderBook;
  loading: boolean;
}

function topLevels(
  bidsMap: Map<number, number>,
  asksMap: Map<number, number>,
  n:       number,
): OrderBook {
  const bids = [...bidsMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, n)
    .map(([price, quantity]) => ({ price, quantity }));
  const asks = [...asksMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(0, n)
    .map(([price, quantity]) => ({ price, quantity }));
  return { bids, asks };
}

export function useOrderBook(
  productId: ProductId,
  levels:    number = 12,
): UseOrderBookResult {
  const [book,    setBook]    = useState<OrderBook>({ bids: [], asks: [] });
  const [loading, setLoading] = useState(true);

  // Full per-side maps. Recreated per symbol-change effect.
  const bidsRef = useRef<Map<number, number>>(new Map());
  const asksRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    let alive = true;
    setLoading(true);
    bidsRef.current = new Map();
    asksRef.current = new Map();
    setBook({ bids: [], asks: [] });

    getOrderBook(productId, 50)
      .then((snap) => {
        if (!alive) return;
        for (const lvl of snap.bids) bidsRef.current.set(lvl.price, lvl.quantity);
        for (const lvl of snap.asks) asksRef.current.set(lvl.price, lvl.quantity);
        setBook(topLevels(bidsRef.current, asksRef.current, levels));
        setLoading(false);
      })
      .catch((err) => {
        console.error("[useOrderBook] seed failed", err);
        if (alive) setLoading(false);
      });

    const unsub = subscribeLevel2(productId, (ev) => {
      if (ev.type === "snapshot") {
        bidsRef.current = new Map(ev.bids.map((l) => [l.price, l.quantity]));
        asksRef.current = new Map(ev.asks.map((l) => [l.price, l.quantity]));
      } else {
        for (const c of ev.changes) {
          const map = c.side === "buy" ? bidsRef.current : asksRef.current;
          if (c.level.quantity === 0) map.delete(c.level.price);
          else                        map.set(c.level.price, c.level.quantity);
        }
      }
      setBook(topLevels(bidsRef.current, asksRef.current, levels));
    });

    return () => { alive = false; unsub(); };
  }, [productId, levels]);

  return { book, loading };
}
