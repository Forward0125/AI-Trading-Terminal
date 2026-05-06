/**
 * Pure-math helpers for the Portfolio dashboard. Everything here is
 * synchronous and stateless — given an account snapshot + a price
 * map, derive KPIs / risk / win rate.
 *
 * Approximations to be honest about:
 *   - Beta is *allocation* beta vs cash (0% cash + 100% crypto = 1.0).
 *     A real beta would regress portfolio returns vs SPY/BTC; we don't
 *     keep that history.
 *   - Drawdown is the peak-to-trough of CUMULATIVE REALIZED P/L. It
 *     ignores intra-trade unrealized excursions.
 *   - VaR is a normal-distribution approximation using a fixed daily
 *     vol per asset class. Good enough to give recruiters a number.
 */

import type { PaperAccount, Position } from "./paper";
import type { ProductId, Ticker } from "./market";

// Rough one-day 95% VaR loss fraction per dollar of position.
const DAILY_VOL_CRYPTO = 0.04;     // 4% daily stdev for spot crypto
const Z_95             = 1.645;

export interface PortfolioStats {
  cash:               number;
  positionValue:      number;
  totalValue:         number;
  unrealizedPnL:      number;
  totalReturn:        number;          // fraction
  realizedPnL:        number;
  openPositions:      number;
  winRate30d:         number;          // fraction (0..1), -1 if no closed trades
  closedTrades30d:    number;
  beta:               number;
  realizedDrawdown:   number;          // fraction of starting cash, positive number
  var95Daily:         number;          // fraction of total value, positive number
}

export function computeStats(
  account: PaperAccount,
  prices:  Map<ProductId, Ticker>,
): PortfolioStats {
  let positionValue = 0;
  let unrealizedPnL = 0;
  for (const p of account.positions) {
    const last = prices.get(p.symbol)?.last ?? p.avgPrice;
    positionValue  += p.qty * last;
    unrealizedPnL  += p.qty * (last - p.avgPrice);
  }

  const totalValue  = account.cash + positionValue;
  const totalReturn = (totalValue - account.startingCash) / account.startingCash;

  // 30-day window for win rate.
  const cutoff = Date.now() - 30 * 86_400 * 1000;
  const closed = account.orderHistory.filter(
    (o) => o.side === "sell" && o.filledAt >= cutoff && o.realizedPnL !== undefined,
  );
  const wins = closed.filter((o) => (o.realizedPnL ?? 0) > 0).length;
  const winRate30d = closed.length > 0 ? wins / closed.length : -1;

  // Realized drawdown: replay realized P/L oldest-first.
  let running = 0;
  let peak    = 0;
  let maxDD   = 0;
  const oldestFirst = [...account.orderHistory]
    .filter((o) => o.realizedPnL !== undefined)
    .sort((a, b) => a.filledAt - b.filledAt);
  for (const o of oldestFirst) {
    running += o.realizedPnL ?? 0;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  }
  const realizedDrawdown = maxDD / account.startingCash;

  // Allocation beta: cash is risk-free (0β), each crypto is 1β.
  const beta = totalValue > 0 ? positionValue / totalValue : 0;

  // VaR (1-day, 95%): stdev * Z * exposure.
  const var95Daily = totalValue > 0
    ? (positionValue * DAILY_VOL_CRYPTO * Z_95) / totalValue
    : 0;

  return {
    cash:             account.cash,
    positionValue,
    totalValue,
    unrealizedPnL,
    totalReturn,
    realizedPnL:      account.realizedPnL,
    openPositions:    account.positions.length,
    winRate30d,
    closedTrades30d:  closed.length,
    beta,
    realizedDrawdown,
    var95Daily,
  };
}

export interface AllocationSlice {
  label:    string;
  value:    number;
  pct:      number;
  isCash:   boolean;
}

export function computeAllocation(
  account: PaperAccount,
  prices:  Map<ProductId, Ticker>,
): AllocationSlice[] {
  let total = account.cash;
  const slices: { label: string; value: number; isCash: boolean }[] = [
    { label: "Cash", value: account.cash, isCash: true },
  ];
  for (const p of account.positions) {
    const last = prices.get(p.symbol)?.last ?? p.avgPrice;
    const v = p.qty * last;
    total += v;
    slices.push({ label: displayName(p), value: v, isCash: false });
  }
  return slices
    .map((s) => ({ ...s, pct: total > 0 ? s.value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}

function displayName(p: Position): string {
  return p.symbol.split("-")[0];
}
