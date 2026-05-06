"use client";

import { Card } from "@/components/Card";
import type { PortfolioStats } from "@/lib/portfolio";
import { cn } from "@/lib/cn";

export function RiskMetricsCard({ stats }: { stats: PortfolioStats }) {
  return (
    <Card title="Portfolio Risk Metrics">
      <div className="p-4 space-y-3 text-sm">
        <Row
          label="Beta vs crypto"
          value={stats.beta.toFixed(2)}
          help="Allocation beta. 0 = all cash, 1 = all crypto. Not a regression beta — needs more trade history."
        />
        <Row
          label="Realized drawdown"
          value={`-${(stats.realizedDrawdown * 100).toFixed(2)}%`}
          tone={stats.realizedDrawdown > 0 ? "down" : undefined}
          help="Peak-to-trough of cumulative realized P/L, as a fraction of starting capital."
        />
        <Row
          label="VaR (1d, 95%)"
          value={`-${(stats.var95Daily * 100).toFixed(2)}%`}
          tone={stats.var95Daily > 0 ? "down" : undefined}
          help="Approximate one-day, 95%-confidence loss using a 4% daily volatility assumption for crypto."
        />
      </div>
    </Card>
  );
}

function Row({
  label,
  value,
  tone,
  help,
}: {
  label: string;
  value: string;
  tone?: "down";
  help?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-muted">{label}</span>
        <span
          className={cn(
            "font-mono tabular-nums",
            tone === "down" ? "text-down" : "text-fg",
          )}
        >
          {value}
        </span>
      </div>
      {help && <div className="text-[11px] text-dim mt-0.5">{help}</div>}
    </div>
  );
}
