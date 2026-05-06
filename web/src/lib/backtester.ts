/**
 * Client-side backtester. Iterates a Candle[] in chronological order,
 * generates buy/sell signals from one of three strategies, and tracks
 * equity bar-by-bar. Outputs the equity curve, every closed trade,
 * and aggregate metrics (total return, annualized Sharpe, max draw-
 * down, win rate). All math is synchronous; even a year of 1m bars
 * (~525k) finishes in under a second on a modern laptop.
 *
 * Conventions:
 *   - Long-only, all-in. On a "buy" signal we deploy 100% of cash;
 *     on "sell" we close the position. Realistic enough for a demo,
 *     simple enough to understand at a glance.
 *   - Fees are bps of notional, applied at entry and exit. Default
 *     10 bps = 0.10% per side, in line with Coinbase Pro fee tiers.
 *   - The annualization factor is derived from the candle spacing,
 *     so the Sharpe number is comparable across timeframes (1m vs 1h
 *     vs 1d) without a config knob.
 */

import { crossover, macd, rsi, sma } from "./indicators";
import type { Candle } from "./market";

export type Signal = "buy" | "sell" | "hold";

export type StrategyConfig =
  | { type: "sma-cross";  fastPeriod: number; slowPeriod: number }
  | { type: "rsi-revert"; period: number; oversold: number; overbought: number }
  | { type: "macd-trend"; fastPeriod: number; slowPeriod: number; signalPeriod: number };

export interface BacktestConfig {
  strategy:    StrategyConfig;
  initialCash: number;
  feeBps:      number;
}

export interface BacktestTrade {
  entryTime:    number;
  entryPrice:   number;
  exitTime:     number;
  exitPrice:    number;
  qty:          number;
  pnl:          number;        // absolute USD, after fees
  pnlPct:       number;        // fraction of cost basis
  durationBars: number;
}

export interface EquityPoint {
  time:   number;
  equity: number;
}

export interface BacktestMetrics {
  totalReturn:  number;        // fraction (0.15 = +15%)
  sharpe:       number;        // annualized
  maxDrawdown:  number;        // fraction (0.20 = -20%)
  winRate:      number;        // fraction (0.5 = 50%)
  numTrades:    number;
  avgTradePnL:  number;        // USD
  finalEquity:  number;
}

export interface BacktestResult {
  config:      BacktestConfig;
  equity:      EquityPoint[];
  trades:      BacktestTrade[];
  metrics:     BacktestMetrics;
}

export const PRESETS: Record<string, StrategyConfig> = {
  "SMA cross 10/30":  { type: "sma-cross",  fastPeriod: 10, slowPeriod: 30 },
  "RSI 14 revert":    { type: "rsi-revert", period: 14, oversold: 30, overbought: 70 },
  "MACD 12/26/9":     { type: "macd-trend", fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
};

// ─── Engine ───────────────────────────────────────────────────────

interface PrecomputedIndicators {
  // SMA / EMA series indexed alongside the candles array.
  // Filled only with whatever the chosen strategy needs.
  fast?:    (number | null)[];
  slow?:    (number | null)[];
  rsi?:     (number | null)[];
  macd?:    (number | null)[];
  signal?:  (number | null)[];
}

function precompute(closes: number[], strat: StrategyConfig): PrecomputedIndicators {
  switch (strat.type) {
    case "sma-cross":
      return {
        fast: sma(closes, strat.fastPeriod),
        slow: sma(closes, strat.slowPeriod),
      };
    case "rsi-revert":
      return { rsi: rsi(closes, strat.period) };
    case "macd-trend": {
      // The macd() helper already does fast EMA - slow EMA + signal EMA.
      const r = macd(closes, strat.fastPeriod, strat.slowPeriod, strat.signalPeriod);
      return { macd: r.macd, signal: r.signal };
    }
  }
}

function evalSignal(
  strat: StrategyConfig,
  ind:   PrecomputedIndicators,
  i:     number,
): Signal {
  switch (strat.type) {
    case "sma-cross": {
      const c = crossover(ind.fast!, ind.slow!, i);
      if (c ===  1) return "buy";
      if (c === -1) return "sell";
      return "hold";
    }
    case "rsi-revert": {
      // Buy when RSI crosses up through oversold; sell when it
      // crosses down through overbought. Strict crossing prevents
      // re-firing while RSI sits flat at the level.
      const cur  = ind.rsi![i];
      const prev = ind.rsi![i - 1];
      if (cur == null || prev == null) return "hold";
      if (prev <= strat.oversold   && cur >  strat.oversold)   return "buy";
      if (prev >= strat.overbought && cur <  strat.overbought) return "sell";
      return "hold";
    }
    case "macd-trend": {
      const c = crossover(ind.macd!, ind.signal!, i);
      if (c ===  1) return "buy";
      if (c === -1) return "sell";
      return "hold";
    }
  }
}

interface OpenPosition {
  qty:        number;
  entryPrice: number;
  entryTime:  number;
  entryBar:   number;
  costBasis:  number;       // notional + entry fee, used for honest P/L
}

export function runBacktest(
  candles: Candle[],
  config:  BacktestConfig,
): BacktestResult {
  const closes  = candles.map((c) => c.close);
  const ind     = precompute(closes, config.strategy);
  const feeRate = config.feeBps / 10_000;

  let cash:     number              = config.initialCash;
  let position: OpenPosition | null = null;

  const equity: EquityPoint[]   = [];
  const trades: BacktestTrade[] = [];

  for (let i = 0; i < candles.length; i++) {
    const bar = candles[i];
    const sig = evalSignal(config.strategy, ind, i);

    if (sig === "buy" && !position && cash > 0) {
      const fee        = cash * feeRate;
      const investable = cash - fee;
      const qty        = investable / bar.close;
      position = {
        qty,
        entryPrice: bar.close,
        entryTime:  bar.time,
        entryBar:   i,
        costBasis:  cash,           // includes the entry fee
      };
      cash = 0;
    } else if (sig === "sell" && position) {
      const grossProceeds = position.qty * bar.close;
      const exitFee       = grossProceeds * feeRate;
      const proceeds      = grossProceeds - exitFee;
      const pnl           = proceeds - position.costBasis;
      const pnlPct        = pnl / position.costBasis;
      trades.push({
        entryTime:    position.entryTime,
        entryPrice:   position.entryPrice,
        exitTime:     bar.time,
        exitPrice:    bar.close,
        qty:          position.qty,
        pnl,
        pnlPct,
        durationBars: i - position.entryBar,
      });
      cash     = proceeds;
      position = null;
    }

    const mtm = position ? position.qty * bar.close : 0;
    equity.push({ time: bar.time, equity: cash + mtm });
  }

  // Force-close any open position at the last bar so metrics include
  // the unrealized P/L instead of dangling.
  if (position && candles.length > 0) {
    const lastBar       = candles[candles.length - 1];
    const grossProceeds = position.qty * lastBar.close;
    const exitFee       = grossProceeds * feeRate;
    const proceeds      = grossProceeds - exitFee;
    const pnl           = proceeds - position.costBasis;
    const pnlPct        = pnl / position.costBasis;
    trades.push({
      entryTime:    position.entryTime,
      entryPrice:   position.entryPrice,
      exitTime:     lastBar.time,
      exitPrice:    lastBar.close,
      qty:          position.qty,
      pnl,
      pnlPct,
      durationBars: candles.length - 1 - position.entryBar,
    });
    cash     = proceeds;
    position = null;
    if (equity.length > 0) equity[equity.length - 1] = { time: lastBar.time, equity: cash };
  }

  return {
    config,
    equity,
    trades,
    metrics: computeMetrics(equity, trades, config, candles),
  };
}

// ─── Metrics ──────────────────────────────────────────────────────

function computeMetrics(
  equity:  EquityPoint[],
  trades:  BacktestTrade[],
  config:  BacktestConfig,
  candles: Candle[],
): BacktestMetrics {
  const initial = config.initialCash;
  const final   = equity[equity.length - 1]?.equity ?? initial;
  const totalReturn = (final - initial) / initial;

  // Bar returns for Sharpe.
  const returns: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1].equity;
    if (prev > 0) returns.push(equity[i].equity / prev - 1);
  }

  const barSec = candles.length > 1 ? candles[1].time - candles[0].time : 60;
  const barsPerYear = (365.25 * 86_400) / barSec;

  let mean = 0;
  for (const r of returns) mean += r;
  mean /= Math.max(1, returns.length);

  let varSum = 0;
  for (const r of returns) varSum += (r - mean) ** 2;
  const variance = varSum / Math.max(1, returns.length - 1);
  const std      = Math.sqrt(variance);
  const sharpe   = std === 0 ? 0 : (mean / std) * Math.sqrt(barsPerYear);

  // Max drawdown.
  let peak  = equity[0]?.equity ?? initial;
  let maxDD = 0;
  for (const p of equity) {
    if (p.equity > peak) peak = p.equity;
    const dd = peak > 0 ? (peak - p.equity) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }

  // Trade-level stats.
  const wins        = trades.filter((t) => t.pnl > 0).length;
  const winRate     = trades.length > 0 ? wins / trades.length : 0;
  const avgTradePnL = trades.length > 0
    ? trades.reduce((s, t) => s + t.pnl, 0) / trades.length
    : 0;

  return {
    totalReturn,
    sharpe,
    maxDrawdown:  maxDD,
    winRate,
    numTrades:    trades.length,
    avgTradePnL,
    finalEquity:  final,
  };
}

