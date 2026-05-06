/**
 * Backtester smoke + correctness checks.
 *   1. Synthetic series with known properties.
 *   2. Live BTC-USD candles to confirm it runs end-to-end without
 *      blowing up on real data and produces sane numbers.
 *
 * Run: npx tsx scripts/smoke-backtester.ts
 */

import { getCandles } from "../src/lib/market/index.ts";
import {
  PRESETS,
  runBacktest,
  type BacktestConfig,
} from "../src/lib/backtester.ts";

function check(label: string, ok: boolean, detail?: string): void {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function bars(values: number[], startSec = 1_700_000_000, stepSec = 60) {
  return values.map((v, i) => ({
    time:   startSec + i * stepSec,
    open:   v,
    high:   v,
    low:    v,
    close:  v,
    volume: 0,
  }));
}

const baseConfig = (strat: BacktestConfig["strategy"]): BacktestConfig => ({
  strategy:    strat,
  initialCash: 10_000,
  feeBps:      10,
});

// 1. Constant series → no signal ever fires → no trades, equity unchanged.
{
  const flat = bars(Array(100).fill(100));
  const r = runBacktest(flat, baseConfig({ type: "sma-cross", fastPeriod: 10, slowPeriod: 30 }));
  check("constant series: 0 trades", r.trades.length === 0);
  check("constant series: final = initial", Math.abs(r.metrics.finalEquity - 10_000) < 0.01);
  check("constant series: drawdown 0", r.metrics.maxDrawdown === 0);
}

// 2. V-shape (declining then rising) → SMA-cross fires at the trough,
//    captures the rebound. A pure monotonic uptrend has NO crossover
//    (fast SMA stays permanently above slow SMA) so we use a V instead.
{
  const v = bars([
    ...Array.from({ length: 60 }, (_, i) => 200 - i),       // 200 -> 141
    ...Array.from({ length: 140 }, (_, i) => 141 + i * 0.7), // 141 -> 238
  ]);
  const r = runBacktest(v, baseConfig({ type: "sma-cross", fastPeriod: 5, slowPeriod: 20 }));
  check("V-shape: at least 1 trade",     r.trades.length >= 1);
  check("V-shape: trade was profitable", r.trades.every((t) => t.pnl > 0));
  check("V-shape: total return > 0",     r.metrics.totalReturn > 0);
  check("V-shape: equity curve grows",
        r.equity.at(-1)!.equity > r.equity[0].equity);
}

// 3. Sine wave → many trades, RSI revert should engage.
{
  const sine = bars(
    Array.from({ length: 400 }, (_, i) => 100 + 20 * Math.sin(i * 0.08)),
  );
  const r = runBacktest(sine, baseConfig(PRESETS["RSI 14 revert"]));
  check("sine: >0 trades", r.trades.length > 0);
  // Equity is finite & non-negative.
  check("sine: equity always finite", r.equity.every((e) => Number.isFinite(e.equity) && e.equity >= 0));
}

// 4. Live BTC-USD across all 3 presets — just verify they don't error.
async function liveCheck(): Promise<void> {
  console.log("\n[live] BTC-USD 1m candles");
  const candles = await getCandles("BTC-USD", 60);
  console.log(`  ${candles.length} candles, last close = ${candles.at(-1)?.close}`);

  for (const [name, strat] of Object.entries(PRESETS)) {
    const r = runBacktest(candles, baseConfig(strat));
    const m = r.metrics;
    console.log(
      `  ${name.padEnd(20)} trades=${String(m.numTrades).padStart(2)} ` +
      `ret=${(m.totalReturn * 100).toFixed(2).padStart(7)}% ` +
      `dd=${(m.maxDrawdown * 100).toFixed(2).padStart(6)}% ` +
      `sharpe=${m.sharpe.toFixed(2).padStart(6)} ` +
      `win=${(m.winRate * 100).toFixed(0).padStart(3)}%`,
    );
    check(`${name}: equity has ${candles.length} points`, r.equity.length === candles.length);
    check(`${name}: metrics finite`,
          Number.isFinite(m.totalReturn) && Number.isFinite(m.sharpe) && Number.isFinite(m.maxDrawdown));
  }
}

liveCheck()
  .then(() => console.log(process.exitCode ? "\n[smoke] FAIL" : "\n[smoke] PASS"))
  .catch((e) => { console.error("[smoke] error:", e); process.exit(2); });
