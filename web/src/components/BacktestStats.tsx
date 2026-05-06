"use client";

import type { BacktestMetrics } from "@/lib/backtester";
import { formatUSD } from "@/lib/paper";
import { cn } from "@/lib/cn";

interface Props {
  metrics:     BacktestMetrics;
  initialCash: number;
}

export function BacktestStats({ metrics, initialCash }: Props) {
  const ret    = metrics.totalReturn;
  const dd     = metrics.maxDrawdown;
  const wins   = metrics.winRate;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
      <Stat
        label="Total Return"
        value={`${ret >= 0 ? "+" : ""}${(ret * 100).toFixed(2)}%`}
        tone={ret > 0 ? "up" : ret < 0 ? "down" : undefined}
      />
      <Stat
        label="Sharpe (ann.)"
        value={metrics.sharpe.toFixed(2)}
        tone={metrics.sharpe > 1 ? "up" : metrics.sharpe < 0 ? "down" : undefined}
      />
      <Stat
        label="Max Drawdown"
        value={`-${(dd * 100).toFixed(2)}%`}
        tone={dd > 0 ? "down" : undefined}
      />
      <Stat
        label="Win Rate"
        value={`${(wins * 100).toFixed(0)}%`}
        tone={wins > 0.5 ? "up" : wins < 0.5 ? "down" : undefined}
      />
      <Stat
        label="Trades"
        value={String(metrics.numTrades)}
      />
      <Stat
        label="Final Equity"
        value={formatUSD(metrics.finalEquity)}
        sub={`from ${formatUSD(initialCash)}`}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?:  string;
  tone?: "up" | "down";
}) {
  return (
    <div className="rounded border border-line bg-elevated/30 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-dim">{label}</div>
      <div
        className={cn(
          "mt-0.5 font-mono tabular-nums text-fg",
          tone === "up"   && "text-up",
          tone === "down" && "text-down",
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-dim mt-0.5">{sub}</div>}
    </div>
  );
}
