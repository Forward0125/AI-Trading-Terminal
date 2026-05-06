"use client";

import { Wallet, TrendingUp, Layers, Target } from "lucide-react";
import { Card } from "@/components/Card";
import type { PortfolioStats } from "@/lib/portfolio";
import { formatUSD } from "@/lib/paper";
import { cn } from "@/lib/cn";

export function KpiStrip({ stats }: { stats: PortfolioStats }) {
  const totalReturnTone =
    stats.totalReturn > 0 ? "up" : stats.totalReturn < 0 ? "down" : undefined;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Kpi
        icon={<Wallet className="size-4" />}
        label="Net Portfolio Value"
        primary={formatUSD(stats.totalValue)}
        secondary={`${stats.totalReturn >= 0 ? "+" : ""}${(stats.totalReturn * 100).toFixed(2)}% lifetime`}
        tone={totalReturnTone}
      />
      <Kpi
        icon={<TrendingUp className="size-4" />}
        label="Unrealized P/L"
        primary={`${stats.unrealizedPnL >= 0 ? "+" : ""}${formatUSD(stats.unrealizedPnL)}`}
        secondary={`Realized ${stats.realizedPnL >= 0 ? "+" : ""}${formatUSD(stats.realizedPnL)}`}
        tone={stats.unrealizedPnL > 0 ? "up" : stats.unrealizedPnL < 0 ? "down" : undefined}
      />
      <Kpi
        icon={<Layers className="size-4" />}
        label="Open Positions"
        primary={String(stats.openPositions)}
        secondary={stats.openPositions === 0 ? "no exposure" : "active exposure"}
      />
      <Kpi
        icon={<Target className="size-4" />}
        label="Win Rate (30d)"
        primary={
          stats.winRate30d >= 0
            ? `${(stats.winRate30d * 100).toFixed(0)}%`
            : "—"
        }
        secondary={
          stats.closedTrades30d === 0
            ? "no closed trades"
            : `${stats.closedTrades30d} closed trade${stats.closedTrades30d === 1 ? "" : "s"}`
        }
        tone={
          stats.winRate30d > 0.5
            ? "up"
            : stats.winRate30d < 0.5 && stats.winRate30d >= 0
              ? "down"
              : undefined
        }
      />
    </div>
  );
}

function Kpi({
  icon,
  label,
  primary,
  secondary,
  tone,
}: {
  icon:       React.ReactNode;
  label:      string;
  primary:    string;
  secondary:  string;
  tone?:      "up" | "down";
}) {
  return (
    <Card>
      <div className="p-4 space-y-1">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
          <span className="text-accent">{icon}</span>
          {label}
        </div>
        <div
          className={cn(
            "text-xl font-semibold font-mono tabular-nums",
            tone === "up"   && "text-up",
            tone === "down" && "text-down",
            !tone           && "text-fg",
          )}
        >
          {primary}
        </div>
        <div className="text-[11px] text-dim">{secondary}</div>
      </div>
    </Card>
  );
}
