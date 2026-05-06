/**
 * Unit checks for the paper-trading store. Runs without DOM
 * (localStorage is undefined in Node), so the lib falls through to
 * the in-memory cache — perfect for testing the business logic.
 *
 * Run: npx tsx scripts/smoke-paper.ts
 */

import {
  loadAccount,
  placeOrder,
  resetAccount,
} from "../src/lib/paper.ts";

function check(label: string, ok: boolean, detail?: string): void {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

resetAccount();

// 1. Initial state.
{
  const a = loadAccount();
  check("starts at $100,000 cash",   a.cash === 100_000);
  check("starts with no positions",  a.positions.length === 0);
  check("starts with no orders",     a.orderHistory.length === 0);
  check("starts realized P/L = 0",   a.realizedPnL === 0);
}

// 2. Buy 0.5 BTC @ $80,000.
{
  const r = placeOrder({ symbol: "BTC-USD", side: "buy", qty: 0.5, price: 80_000 });
  check("first buy 0.5 BTC succeeded", r.ok === true);
  if (r.ok) {
    check("cash 60000 after first buy", r.account.cash === 60_000, `got ${r.account.cash}`);
    check("position qty 0.5",           r.account.positions[0].qty === 0.5);
    check("position avg 80000",         r.account.positions[0].avgPrice === 80_000);
  }
}

// 3. Buy 0.5 BTC @ $82,000 -> weighted avg = 81000.
{
  const r = placeOrder({ symbol: "BTC-USD", side: "buy", qty: 0.5, price: 82_000 });
  check("second buy 0.5 BTC succeeded", r.ok === true);
  if (r.ok) {
    // weighted avg = (0.5*80000 + 0.5*82000) / 1.0 = 81000
    const avg = r.account.positions[0].avgPrice;
    check("weighted avg = 81000",  Math.abs(avg - 81_000) < 0.01, `got ${avg}`);
    check("qty now 1.0",           Math.abs(r.account.positions[0].qty - 1.0) < 1e-9);
    check("cash 19000 after both", Math.abs(r.account.cash - 19_000) < 0.01);
  }
}

// 4. Sell 0.3 BTC @ $83,000 -> realized P/L = 0.3 * (83000-81000) = 600.
{
  const r = placeOrder({ symbol: "BTC-USD", side: "sell", qty: 0.3, price: 83_000 });
  check("sell 0.3 BTC succeeded", r.ok === true);
  if (r.ok) {
    const pnl = r.account.realizedPnL;
    check("realized P/L = +600", Math.abs(pnl - 600) < 0.01, `got ${pnl}`);
    check("remaining qty 0.7",   Math.abs(r.account.positions[0].qty - 0.7) < 1e-9);
    check("avg unchanged on partial close",
          Math.abs(r.account.positions[0].avgPrice - 81_000) < 0.01);
    check("cash 43900 after sell",
          Math.abs(r.account.cash - 43_900) < 0.01, `got ${r.account.cash}`);
  }
}

// 5. Insufficient cash.
{
  const r = placeOrder({ symbol: "BTC-USD", side: "buy", qty: 100, price: 80_000 });
  check("rejects buy past cash", r.ok === false);
  if (!r.ok) check("error message clear", r.error.includes("insufficient cash"));
}

// 6. Sell more than held.
{
  const r = placeOrder({ symbol: "BTC-USD", side: "sell", qty: 5, price: 80_000 });
  check("rejects sell past holdings", r.ok === false);
  if (!r.ok) check("error mentions holdings", r.error.includes("only"));
}

// 7. Sell remaining -> position removed.
{
  const a = loadAccount();
  const r = placeOrder({ symbol: "BTC-USD", side: "sell", qty: a.positions[0].qty, price: 81_000 });
  check("close-out sell succeeded", r.ok === true);
  if (r.ok) {
    check("position removed after full close",
          r.account.positions.find((p) => p.symbol === "BTC-USD") === undefined);
  }
}

// 8. Reset.
{
  const a = resetAccount();
  check("reset restores starting cash", a.cash === 100_000);
  check("reset clears positions",       a.positions.length === 0);
  check("reset clears history",         a.orderHistory.length === 0);
  check("reset clears realized P/L",    a.realizedPnL === 0);
}

// 9. Bad inputs.
{
  const r = placeOrder({ symbol: "BTC-USD", side: "buy", qty: 0, price: 100 });
  check("rejects qty=0", r.ok === false);
}
{
  const r = placeOrder({ symbol: "BTC-USD", side: "buy", qty: 1, price: 0 });
  check("rejects price=0", r.ok === false);
}

console.log(process.exitCode ? "\n[smoke] FAIL" : "\n[smoke] PASS");
