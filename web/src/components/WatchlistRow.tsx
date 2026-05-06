"use client";

/**
 * One row in the Market Overview watchlist. Live last price via
 * useTicker; 24h change + sparkline pulled once via REST.
 *
 * Click anywhere on the row to navigate to the Dashboard with
 * that symbol pre-selected (URL search param).
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "./Card";
import { Sparkline } from "./Sparkline";
import { useTicker } from "@/hooks/useTicker";
import {
  formatPrice,
  get24hStats,
  getCandles,
  type MarketStats,
  type ProductId,
  type SymbolInfo,
} from "@/lib/market";
import { cn } from "@/lib/cn";

interface Props { symbol: SymbolInfo }

export function WatchlistRow({ symbol }: Props) {
  const ticker            = useTicker(symbol.id);
  const [stats,    setStats]    = useState<MarketStats | null>(null);
  const [sparkline, setSparkline] = useState<number[]>([]);

  useEffect(() => {
    let alive = true;
    setStats(null);
    setSparkline([]);

    get24hStats(symbol.id).then((s) => { if (alive) setStats(s); }).catch(() => {});
    // 1h candles, 24 of them ≈ last day for the sparkline.
    getCandles(symbol.id, 3600).then((c) => {
      if (!alive) return;
      const tail = c.slice(-24);
      setSparkline(tail.map((b) => b.close));
    }).catch(() => {});

    return () => { alive = false; };
  }, [symbol.id]);

  // Prefer the WS-fed last price; fall back to REST stats while WS warms up.
  const last = ticker?.last ?? stats?.last ?? null;
  const up   = stats ? stats.change >= 0 : true;
  const color = up ? "#22c55e" : "#ef4444";

  return (
    <Link
      href={{ pathname: "/", query: { symbol: symbol.id } }}
      className="block hover:bg-elevated/40 transition-colors rounded-md"
    >
      <Card className="!rounded-md !border-line/60 hover:!border-line">
        <div className="p-4 grid grid-cols-[1fr_auto_auto] items-center gap-4">
          <div>
            <div className="font-medium text-fg">{symbol.display}</div>
            <div className="text-[11px] text-dim mt-0.5">{symbol.base}</div>
          </div>

          <div className="hidden sm:block">
            {sparkline.length >= 2 ? (
              <Sparkline values={sparkline} color={color} />
            ) : (
              <div className="w-[120px] h-8 rounded bg-line/30 animate-pulse" />
            )}
          </div>

          <div className="text-right">
            <div className="font-mono tabular-nums text-fg text-base">
              {last != null ? formatPrice(last, symbol) : "…"}
            </div>
            <div
              className={cn(
                "text-xs font-mono tabular-nums mt-0.5",
                stats ? (up ? "text-up" : "text-down") : "text-dim",
              )}
            >
              {stats
                ? `${up ? "+" : ""}${stats.change.toFixed(2)} (${up ? "+" : ""}${(stats.changePct * 100).toFixed(2)}%)`
                : "loading 24h"}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

// re-export for the page to type its props
export type { ProductId };
