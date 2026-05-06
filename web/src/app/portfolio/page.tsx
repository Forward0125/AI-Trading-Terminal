"use client";

/**
 * Portfolio Analytics — matches screenshot 03_3.
 *
 * Layout:
 *   - KPI strip (4 tiles)
 *   - Two-column body:  Allocation card    | Signal Alerts
 *                       (left)             | Risk Metrics
 *   - Active Positions table (full width)
 *
 * Everything is derived live from `usePaperAccount()` + `useTickers()`
 * for the held symbols. No backend.
 */

import { useMemo } from "react";
import { ActivePositionsTable } from "@/components/portfolio/ActivePositionsTable";
import { AllocationCard }       from "@/components/portfolio/AllocationCard";
import { KpiStrip }              from "@/components/portfolio/KpiStrip";
import { RiskMetricsCard }       from "@/components/portfolio/RiskMetricsCard";
import { SignalAlertsCard }      from "@/components/portfolio/SignalAlertsCard";
import { usePaperAccount } from "@/hooks/usePaperAccount";
import { useTickers }       from "@/hooks/useTickers";
import { computeAllocation, computeStats } from "@/lib/portfolio";

export default function Page() {
  const account  = usePaperAccount();
  const symbols  = useMemo(() => account.positions.map((p) => p.symbol), [account.positions]);
  const tickers  = useTickers(symbols);

  const stats      = useMemo(() => computeStats(account, tickers),      [account, tickers]);
  const allocation = useMemo(() => computeAllocation(account, tickers), [account, tickers]);

  return (
    <div className="space-y-6">
      <KpiStrip stats={stats} />

      <div className="grid lg:grid-cols-[1fr_22rem] gap-6">
        <AllocationCard slices={allocation} />

        <div className="space-y-6">
          <SignalAlertsCard />
          <RiskMetricsCard stats={stats} />
        </div>
      </div>

      <ActivePositionsTable account={account} />
    </div>
  );
}
