/**
 * Pure-function checks for lib/portfolio.ts.
 * Run: npx tsx scripts/smoke-portfolio.ts
 */

import {
  computeAllocation,
  computeStats,
} from "../src/lib/portfolio.ts";
import type { PaperAccount } from "../src/lib/paper.ts";
import type { ProductId, Ticker } from "../src/lib/market/index.ts";

function check(label: string, ok: boolean, detail?: string): void {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function ticker(productId: ProductId, last: number): Ticker {
  return { productId, bid: last, ask: last, last, volume24h: 0, time: Date.now() };
}

// 1. Empty account.
{
  const acc: PaperAccount = {
    version: 1, startingCash: 100_000, cash: 100_000,
    positions: [], orderHistory: [], realizedPnL: 0, createdAt: Date.now(),
  };
  const s = computeStats(acc, new Map());
  check("empty: total = cash",       s.totalValue === 100_000);
  check("empty: position value 0",   s.positionValue === 0);
  check("empty: total return 0",     s.totalReturn === 0);
  check("empty: open positions 0",   s.openPositions === 0);
  check("empty: win rate -1",        s.winRate30d === -1);
  check("empty: closed trades 0",    s.closedTrades30d === 0);
  check("empty: beta 0",             s.beta === 0);
  check("empty: drawdown 0",         s.realizedDrawdown === 0);
  check("empty: var 0",              s.var95Daily === 0);

  const alloc = computeAllocation(acc, new Map());
  check("empty alloc: 1 slice (cash)",        alloc.length === 1);
  check("empty alloc: cash 100%",             alloc[0].pct === 1);
}

// 2. Account with 1 BTC bought at 80k, current price 82k.
{
  const acc: PaperAccount = {
    version: 1, startingCash: 100_000, cash: 20_000,
    positions: [{ symbol: "BTC-USD", qty: 1, avgPrice: 80_000, openedAt: 0 }],
    orderHistory: [
      { id: "o1", symbol: "BTC-USD", side: "buy", qty: 1, price: 80_000,
        notional: 80_000, filledAt: Date.now() - 60_000 },
    ],
    realizedPnL: 0, createdAt: 0,
  };
  const prices = new Map<ProductId, Ticker>([["BTC-USD", ticker("BTC-USD", 82_000)]]);
  const s = computeStats(acc, prices);

  check("1 BTC: position value 82000",   s.positionValue === 82_000);
  check("1 BTC: total value 102000",     s.totalValue === 102_000);
  check("1 BTC: unrealized P/L +2000",   s.unrealizedPnL === 2_000);
  check("1 BTC: total return +2%",       Math.abs(s.totalReturn - 0.02) < 1e-9);
  check("1 BTC: open positions 1",       s.openPositions === 1);
  // beta = positionValue / total = 82000 / 102000 ≈ 0.8039
  check("1 BTC: beta ~0.80",
        Math.abs(s.beta - 82_000 / 102_000) < 1e-9, `got ${s.beta.toFixed(4)}`);

  const alloc = computeAllocation(acc, prices);
  check("alloc: 2 slices",            alloc.length === 2);
  check("alloc: BTC bigger than cash", alloc[0].label === "BTC");
  check("alloc: percentages sum to 1",
        Math.abs(alloc.reduce((s, x) => s + x.pct, 0) - 1) < 1e-9);
}

// 3. Realized drawdown: +500, +200, -300, -400, +100.
//    cumulative: 500, 700, 400, 0, 100. peak = 700, trough at 0, DD = 700.
{
  const start = Date.now() - 86_400 * 1000;
  const orders = [500, 200, -300, -400, 100].map((pnl, i) => ({
    id: `o${i}`,
    symbol: "BTC-USD" as ProductId,
    side: "sell" as const,
    qty: 0.1,
    price: 80_000,
    notional: 8_000,
    filledAt: start + i * 1000,
    realizedPnL: pnl,
  }));
  const acc: PaperAccount = {
    version: 1, startingCash: 100_000, cash: 100_100,
    positions: [], orderHistory: orders,
    realizedPnL: 100, createdAt: 0,
  };
  const s = computeStats(acc, new Map());
  // max DD = 700 / 100000 = 0.007
  check("drawdown peak-to-trough",
        Math.abs(s.realizedDrawdown - 0.007) < 1e-9, `got ${s.realizedDrawdown}`);
  // win rate: 3 wins (500, 200, 100), 2 losses → 60%
  check("win rate 60%",
        Math.abs(s.winRate30d - 0.6) < 1e-9, `got ${s.winRate30d}`);
  check("5 closed trades", s.closedTrades30d === 5);
}

console.log(process.exitCode ? "\n[smoke] FAIL" : "\n[smoke] PASS");
