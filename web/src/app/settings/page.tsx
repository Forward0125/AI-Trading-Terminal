"use client";

/**
 * Settings page — what the demo can actually expose:
 *   - Paper account stats + reset
 *   - Default symbol picker
 *   - Local storage clear (signals cache, last backtest)
 *
 * Stuff that requires server state (account auth, billing, theme)
 * isn't implemented because the whole app is browser-only by design.
 */

import { Card } from "@/components/Card";
import { usePaperAccount } from "@/hooks/usePaperAccount";
import { resetAccount, formatUSD } from "@/lib/paper";

export default function Page() {
  const account = usePaperAccount();

  function onResetPaper() {
    if (window.confirm(
      "Reset paper account to $100,000?\n\nThis clears all open positions and order history. The action can't be undone.",
    )) {
      resetAccount();
    }
  }

  function onClearCaches() {
    if (typeof localStorage === "undefined") return;
    if (!window.confirm("Clear cached AI signals and the latest backtest result?")) return;
    const removed: string[] = [];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("ait:signal:") || k === "ait:backtest:latest") {
        localStorage.removeItem(k);
        removed.push(k);
      }
    }
    window.alert(`Cleared ${removed.length} cache entr${removed.length === 1 ? "y" : "ies"}.`);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card title="Paper Trading">
        <div className="p-4 space-y-3 text-sm">
          <Stat label="Cash"          value={formatUSD(account.cash)} />
          <Stat label="Realized P/L" value={`${account.realizedPnL >= 0 ? "+" : ""}${formatUSD(account.realizedPnL)}`} />
          <Stat label="Open positions" value={String(account.positions.length)} />
          <Stat label="Order history"  value={`${account.orderHistory.length} order${account.orderHistory.length === 1 ? "" : "s"}`} />
          <button
            type="button"
            onClick={onResetPaper}
            className="mt-3 px-3 py-2 rounded text-sm border border-down/30 bg-down/10 text-down hover:bg-down/15 transition-colors"
          >
            Reset paper account to $100,000
          </button>
        </div>
      </Card>

      <Card title="Caches">
        <div className="p-4 space-y-3 text-sm">
          <p className="text-muted">
            AI signals are cached in <code className="text-fg">localStorage</code> with a 5-minute TTL,
            keyed by symbol. The most-recent backtest result is also persisted so the
            Dashboard&rsquo;s summary card survives a hard refresh.
          </p>
          <button
            type="button"
            onClick={onClearCaches}
            className="px-3 py-2 rounded text-sm border border-line text-fg hover:bg-elevated transition-colors"
          >
            Clear cached signals + last backtest
          </button>
        </div>
      </Card>

      <Card title="About this app">
        <div className="p-4 text-sm text-muted leading-relaxed space-y-2">
          <p>
            Live crypto data: Coinbase Exchange public REST + WebSocket (browser-direct, no auth).
          </p>
          <p>
            AI signals: gpt-4o-mini via a Vercel serverless route, with strict JSON-schema response
            and a 5-minute client-side cache.
          </p>
          <p>
            Paper trading + last backtest live in <code className="text-fg">localStorage</code> &mdash;
            per-browser, no server. Clearing cookies erases everything.
          </p>
          <p className="text-dim text-[11px] pt-1">
            Portfolio demo. Not investment advice. Not a real brokerage.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line/40 pb-2 last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-mono tabular-nums text-fg">{value}</span>
    </div>
  );
}
