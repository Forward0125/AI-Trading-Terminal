"use client";

import { Card } from "@/components/Card";
import type { AllocationSlice } from "@/lib/portfolio";
import { formatUSD } from "@/lib/paper";
import { cn } from "@/lib/cn";

const COLORS = [
  "#06b6d4", // cash teal
  "#fb923c", // BTC orange
  "#a78bfa", // ETH purple
  "#22c55e", // SOL green
  "#ef4444", // DOGE red
  "#3b82f6", // AVAX blue
  "#f59e0b", // fallback amber
];

export function AllocationCard({ slices }: { slices: AllocationSlice[] }) {
  const nonZero = slices.filter((s) => s.value > 0);
  const empty = nonZero.length === 0;

  return (
    <Card title="Portfolio Allocation">
      <div className="p-4 space-y-3">
        {empty ? (
          <p className="py-6 text-center text-sm text-muted">
            No funds yet — your $100,000 starts as 100% cash.
          </p>
        ) : (
          <>
            <div className="h-3 w-full rounded-full bg-elevated overflow-hidden flex">
              {nonZero.map((s, i) => (
                <div
                  key={s.label}
                  className="h-full"
                  style={{
                    width:           `${s.pct * 100}%`,
                    backgroundColor: COLORS[i % COLORS.length],
                  }}
                  title={`${s.label}: ${(s.pct * 100).toFixed(2)}%`}
                />
              ))}
            </div>

            <ul className="space-y-1.5">
              {nonZero.map((s, i) => (
                <li
                  key={s.label}
                  className="grid grid-cols-[auto_1fr_auto_auto] items-baseline gap-3 text-xs"
                >
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className={cn(s.isCash ? "text-muted" : "text-fg font-medium")}>
                    {s.label}
                    {s.isCash && <span className="text-dim text-[10px] ml-1">(idle)</span>}
                  </span>
                  <span className="text-fg font-mono tabular-nums">{formatUSD(s.value)}</span>
                  <span className="text-muted font-mono tabular-nums w-12 text-right">
                    {(s.pct * 100).toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}
