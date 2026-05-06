"use client";

import type { BacktestTrade } from "@/lib/backtester";
import { formatPrice, getSymbol, type ProductId } from "@/lib/market";
import { formatUSD } from "@/lib/paper";
import { cn } from "@/lib/cn";

interface Props {
  trades:     BacktestTrade[];
  productId:  ProductId;
}

export function TradesTable({ trades, productId }: Props) {
  const sym = getSymbol(productId);
  if (trades.length === 0) {
    return (
      <p className="text-xs text-muted py-4">
        No trades closed during this window.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-dim border-b border-line">
            <th className="text-left  py-2 px-2">Entry</th>
            <th className="text-right py-2 px-2">Entry Price</th>
            <th className="text-left  py-2 px-2">Exit</th>
            <th className="text-right py-2 px-2">Exit Price</th>
            <th className="text-right py-2 px-2">Qty</th>
            <th className="text-right py-2 px-2">P/L</th>
            <th className="text-right py-2 px-2">Return</th>
            <th className="text-right py-2 px-2">Bars</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={i} className="border-b border-line/40 hover:bg-elevated/40 transition-colors">
              <td className="py-1.5 px-2 text-muted font-mono tabular-nums">
                {fmtTime(t.entryTime)}
              </td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums text-fg">
                {formatPrice(t.entryPrice, sym)}
              </td>
              <td className="py-1.5 px-2 text-muted font-mono tabular-nums">
                {fmtTime(t.exitTime)}
              </td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums text-fg">
                {formatPrice(t.exitPrice, sym)}
              </td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums text-muted">
                {t.qty.toFixed(6)}
              </td>
              <td
                className={cn(
                  "py-1.5 px-2 text-right font-mono tabular-nums",
                  t.pnl > 0 ? "text-up" : t.pnl < 0 ? "text-down" : "text-muted",
                )}
              >
                {t.pnl >= 0 ? "+" : ""}{formatUSD(t.pnl)}
              </td>
              <td
                className={cn(
                  "py-1.5 px-2 text-right font-mono tabular-nums",
                  t.pnlPct > 0 ? "text-up" : t.pnlPct < 0 ? "text-down" : "text-muted",
                )}
              >
                {t.pnlPct >= 0 ? "+" : ""}{(t.pnlPct * 100).toFixed(2)}%
              </td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums text-dim">
                {t.durationBars}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString([], {
    month:  "short",
    day:    "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}
