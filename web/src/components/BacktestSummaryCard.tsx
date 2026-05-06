"use client";

/**
 * Dashboard's "Backtesting Insights" card. Reads the most-recent
 * backtest from localStorage; shows headline metrics + a link to
 * the full /backtesting page. Empty state nudges toward running one.
 */

import Link from "next/link";
import { ArrowRight, Repeat } from "lucide-react";
import { Card } from "./Card";
import { useBacktest } from "@/hooks/useBacktest";
import { cn } from "@/lib/cn";

export function BacktestSummaryCard() {
  const stored = useBacktest();

  if (!stored) {
    return (
      <Card title="Backtesting Insights">
        <div className="p-6 text-sm text-muted space-y-3">
          <p>No backtest run yet. Try a strategy on real Coinbase candles &mdash; all client-side.</p>
          <Link
            href="/backtesting"
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            Run your first backtest <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </Card>
    );
  }

  const { result, presetName, productId, granularity, ranAt } = stored;
  const m = result.metrics;
  const ago = humanAgo(Date.now() - ranAt);
  const granLabel = ({ 60: "1m", 300: "5m", 900: "15m", 3600: "1h", 21600: "6h", 86400: "1d" } as Record<number, string>)[granularity] ?? `${granularity}s`;

  return (
    <Card
      title="Backtesting Insights"
      action={
        <Link
          href="/backtesting"
          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-fg transition-colors"
        >
          <Repeat className="size-3" /> Re-run
        </Link>
      }
    >
      <div className="p-4 space-y-3">
        <div className="text-xs text-muted">
          Strategy: <span className="text-fg font-medium">{presetName}</span>
          <span className="text-dim"> &middot; </span>
          <span className="text-fg">{productId}</span>
          <span className="text-dim"> &middot; </span>
          <span className="text-fg">{granLabel}</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <Row label="Total Return"  value={`${m.totalReturn >= 0 ? "+" : ""}${(m.totalReturn * 100).toFixed(2)}%`} tone={m.totalReturn > 0 ? "up" : m.totalReturn < 0 ? "down" : undefined} />
          <Row label="Sharpe (ann.)" value={m.sharpe.toFixed(2)} tone={m.sharpe > 1 ? "up" : m.sharpe < 0 ? "down" : undefined} />
          <Row label="Max Drawdown"  value={`-${(m.maxDrawdown * 100).toFixed(2)}%`} tone="down" />
          <Row label="Win Rate"      value={`${(m.winRate * 100).toFixed(0)}% (${m.numTrades} trades)`} tone={m.winRate > 0.5 ? "up" : m.winRate < 0.5 && m.numTrades > 0 ? "down" : undefined} />
        </div>

        <p className="text-[11px] text-dim border-t border-line pt-2">
          Last run {ago} &middot; portfolio demo, not investment advice.
        </p>
      </div>
    </Card>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <>
      <span className="text-muted">{label}</span>
      <span
        className={cn(
          "text-right font-mono tabular-nums",
          tone === "up"   && "text-up",
          tone === "down" && "text-down",
          !tone           && "text-fg",
        )}
      >
        {value}
      </span>
    </>
  );
}

function humanAgo(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60)         return `${sec}s ago`;
  if (sec < 3600)       return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86_400)     return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86_400)}d ago`;
}
