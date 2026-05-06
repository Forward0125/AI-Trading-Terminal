"use client";

/**
 * Backtesting page — strategy + symbol + granularity picker, Run
 * button, equity chart, stats grid, trade list. The whole pipeline
 * runs client-side: getCandles() (REST) -> runBacktest() (pure CPU).
 *
 * Result is persisted to localStorage so the dashboard's
 * BacktestSummaryCard can show stats even after a hard refresh.
 */

import { useState } from "react";
import { Loader2, Play, AlertCircle } from "lucide-react";
import { Card } from "@/components/Card";
import { EquityChart } from "@/components/EquityChart";
import { BacktestStats } from "@/components/BacktestStats";
import { TradesTable } from "@/components/TradesTable";
import { useBacktest } from "@/hooks/useBacktest";
import {
  PRESETS,
  runBacktest,
  type BacktestResult,
} from "@/lib/backtester";
import { saveBacktest } from "@/lib/backtest-store";
import {
  SYMBOLS,
  getCandles,
  type Granularity,
  type ProductId,
} from "@/lib/market";
import { cn } from "@/lib/cn";

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: 60,    label: "1m" },
  { value: 300,   label: "5m" },
  { value: 900,   label: "15m" },
  { value: 3600,  label: "1h" },
  { value: 21600, label: "6h" },
  { value: 86400, label: "1d" },
];

const INITIAL_CASH = 10_000;
const FEE_BPS      = 10;

export default function Page() {
  const stored = useBacktest();
  const [presetName,  setPresetName]  = useState<string>(stored?.presetName ?? "MACD 12/26/9");
  const [productId,   setProductId]   = useState<ProductId>(stored?.productId ?? "BTC-USD");
  const [granularity, setGranularity] = useState<Granularity>(stored?.granularity ?? 3600);
  const [running, setRunning] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [result,  setResult]  = useState<BacktestResult | null>(stored?.result ?? null);

  async function onRun(): Promise<void> {
    setRunning(true);
    setError(null);
    try {
      const candles = await getCandles(productId, granularity);
      if (candles.length < 30) {
        setError(`only ${candles.length} candles returned — try a different granularity`);
        return;
      }
      const strat = PRESETS[presetName];
      if (!strat) {
        setError(`unknown preset: ${presetName}`);
        return;
      }
      const r = runBacktest(candles, {
        strategy:    strat,
        initialCash: INITIAL_CASH,
        feeBps:      FEE_BPS,
      });
      setResult(r);
      saveBacktest({
        productId,
        granularity,
        presetName,
        result:      r,
        ranAt:       Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Strategy Backtest & Optimization">
        <div className="p-4 grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <Field label="Strategy">
            <Select value={presetName} onChange={setPresetName}>
              {Object.keys(PRESETS).map((k) => <option key={k} value={k}>{k}</option>)}
            </Select>
          </Field>
          <Field label="Symbol">
            <Select
              value={productId}
              onChange={(v) => setProductId(v as ProductId)}
            >
              {SYMBOLS.map((s) => <option key={s.id} value={s.id}>{s.display}</option>)}
            </Select>
          </Field>
          <Field label="Granularity">
            <Select
              value={String(granularity)}
              onChange={(v) => setGranularity(Number(v) as Granularity)}
            >
              {GRANULARITIES.map((g) => (
                <option key={g.value} value={g.value}>{g.label} (~{candleCoverage(g.value)})</option>
              ))}
            </Select>
          </Field>
          <button
            type="button"
            onClick={onRun}
            disabled={running}
            className={cn(
              "h-9 px-4 rounded-md font-medium text-sm inline-flex items-center justify-center gap-2",
              "bg-accent text-page hover:bg-accent/85 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {running
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Play className="size-3.5" />}
            {running ? "Running…" : "Run Backtest"}
          </button>
        </div>

        {error && (
          <div className="mx-4 mb-4 px-3 py-2 rounded border border-down/30 bg-down/5 text-xs text-fg flex items-start gap-2">
            <AlertCircle className="size-4 text-down shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </Card>

      {!result && !running && (
        <Card>
          <div className="p-12 text-center text-sm text-muted">
            Pick a strategy and hit <span className="text-fg font-medium">Run Backtest</span>.
            All math is browser-side &mdash; no backend, no waiting on a server.
          </div>
        </Card>
      )}

      {result && (
        <>
          <Card title={`Results · ${presetName} on ${productId}`}>
            <div className="p-4 space-y-4">
              <BacktestStats metrics={result.metrics} initialCash={INITIAL_CASH} />
              <EquityChart equity={result.equity} initialCash={INITIAL_CASH} />
            </div>
          </Card>

          <Card title={`Trades (${result.trades.length})`}>
            <div className="p-4">
              <TradesTable trades={result.trades} productId={productId} />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Tiny helpers ─────────────────────────────────────────────────

function candleCoverage(granSec: number): string {
  // Coinbase returns up to 300-350 candles per request; show "~5h"
  // / "~12d" / etc to set expectations on the picker.
  const totalSec = granSec * 300;
  const hours    = totalSec / 3600;
  if (hours < 24)            return `${hours.toFixed(0)}h coverage`;
  const days = hours / 24;
  if (days < 60)             return `${days.toFixed(0)}d coverage`;
  return `${(days / 30).toFixed(0)}mo coverage`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider text-muted mb-1">{label}</div>
      {children}
    </label>
  );
}

function Select<T extends string>({
  value,
  onChange,
  children,
}: {
  value:    T;
  onChange: (v: T) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full bg-elevated border border-line rounded px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent appearance-none cursor-pointer"
    >
      {children}
    </select>
  );
}

