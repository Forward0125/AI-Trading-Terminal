"use client";

/**
 * Trade History panel — most recent trades for the active symbol.
 *
 * Coinbase's `side` field is the TAKER side: `"buy"` means a bid was
 * lifted (price likely tagged the ask), so we render it green ("BUY"
 * pressure). We don't try to be cleverer than that — the screenshot
 * just labels every row BUY/SELL.
 */

import { Card } from "./Card";
import { useRecentTrades } from "@/hooks/useRecentTrades";
import { formatPrice, getSymbol, type ProductId, type Trade } from "@/lib/market";
import { cn } from "@/lib/cn";

interface Props {
  productId: ProductId;
}

export function TradeHistoryPanel({ productId }: Props) {
  const trades = useRecentTrades(productId, 30);
  const sym    = getSymbol(productId);

  return (
    <Card title="Trade History">
      <div className="px-3 pb-3">
        <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 text-[10px] uppercase tracking-wider text-dim px-2 py-1">
          <span>Side</span>
          <span className="text-right">Size</span>
          <span className="text-right">Price</span>
          <span className="text-right">Time</span>
        </div>
        {trades.length === 0 ? (
          <div className="px-2 py-8 text-center text-xs text-muted">Loading tape&hellip;</div>
        ) : (
          <ul className="mt-1 space-y-px">
            {trades.map((t) => (
              <Row key={t.id} t={t} sym={sym} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function Row({ t, sym }: { t: Trade; sym: ReturnType<typeof getSymbol> }) {
  const isBuy = t.side === "buy";
  return (
    <li className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 text-xs font-mono tabular-nums px-2 py-0.5 hover:bg-elevated/50 rounded-sm transition-colors">
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-wider self-center",
          isBuy ? "text-up" : "text-down",
        )}
      >
        {isBuy ? "BUY" : "SELL"}
      </span>
      <span className="text-right text-fg">{t.size.toFixed(5)}</span>
      <span className={cn("text-right", isBuy ? "text-up" : "text-down")}>
        {formatPrice(t.price, sym)}
      </span>
      <span className="text-right text-muted">{formatTime(t.time)}</span>
    </li>
  );
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
