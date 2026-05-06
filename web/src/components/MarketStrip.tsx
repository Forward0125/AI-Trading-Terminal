"use client";

/**
 * The OHLCV strip above the chart, mirroring the screenshot:
 *   BTC/USD · 1m   O 81,150.00  H 81,250.00  L 81,090.00  C 81,148.00  +135.50 (+0.17%)
 *
 * Reads from the most recent candle. The previous-bar close is used so
 * the change number reflects bar-over-bar movement rather than the
 * intra-bar move (which would jitter).
 */

import type { Candle } from "@/lib/market";
import { formatPrice, getSymbol, type ProductId } from "@/lib/market";
import { cn } from "@/lib/cn";

interface Props {
  productId: ProductId;
  candles:   Candle[];
}

export function MarketStrip({ productId, candles }: Props) {
  const sym  = getSymbol(productId);
  const last = candles.at(-1);
  const prev = candles.at(-2);
  const display = sym?.display ?? productId;

  if (!last) {
    return (
      <div className="text-xs text-muted font-mono">
        {display} &middot; 1m &middot; loading&hellip;
      </div>
    );
  }

  const change    = prev ? last.close - prev.close : 0;
  const changePct = prev && prev.close !== 0 ? (change / prev.close) * 100 : 0;
  const up        = change >= 0;

  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs font-mono tabular-nums">
      <span className="text-fg font-semibold not-italic">{display}</span>
      <span className="text-dim">&middot; 1m</span>

      <span className="text-muted">O <span className="text-fg">{formatPrice(last.open,  sym)}</span></span>
      <span className="text-muted">H <span className="text-fg">{formatPrice(last.high,  sym)}</span></span>
      <span className="text-muted">L <span className="text-fg">{formatPrice(last.low,   sym)}</span></span>
      <span className="text-muted">C <span className="text-fg">{formatPrice(last.close, sym)}</span></span>

      <span className={cn("font-medium", up ? "text-up" : "text-down")}>
        {up ? "+" : ""}{change.toFixed(2)}
        <span className="ml-1 opacity-80">({up ? "+" : ""}{changePct.toFixed(2)}%)</span>
      </span>
    </div>
  );
}
