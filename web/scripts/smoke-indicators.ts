/**
 * Smoke + correctness checks for the indicator engine. Run with:
 *   npx tsx scripts/smoke-indicators.ts
 *
 * Strategy:
 *   1. Synthetic series with known answers — verifies the math.
 *   2. Run all indicators over live BTC-USD candles and print last
 *      values, verifying lengths align and last values are sane.
 */

import { getCandles } from "../src/lib/market/index.ts";
import {
  bollinger,
  crossover,
  ema,
  lastDefined,
  macd,
  rsi,
  sma,
} from "../src/lib/indicators.ts";

function approxEqual(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

function check(label: string, ok: boolean, detail?: string): void {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

console.log("[unit] synthetic checks");

// SMA of [1..5] period 3 → [_, _, 2, 3, 4]
{
  const s = sma([1, 2, 3, 4, 5], 3);
  check("sma length",    s.length === 5);
  check("sma leading nulls", s[0] === null && s[1] === null);
  check("sma values",    s[2] === 2 && s[3] === 3 && s[4] === 4);
}

// EMA of constant series equals that constant
{
  const s = ema([7, 7, 7, 7, 7, 7, 7, 7], 3);
  const last = lastDefined(s);
  check("ema constant series", last !== null && approxEqual(last, 7));
}

// RSI of monotonically rising series → 100 (no losses)
{
  const r = rsi([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 14);
  const last = lastDefined(r);
  check("rsi pure uptrend = 100", last === 100, `got ${last}`);
}

// Bollinger middle equals SMA
{
  const v = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
  const b = bollinger(v, 20, 2);
  const s = sma(v, 20);
  check("bollinger middle = sma", b.middle.at(-1) === s.at(-1));
  check("bollinger upper > middle", (b.upper.at(-1) as number) > (b.middle.at(-1) as number));
}

// Crossover detection — strict: equal bars don't count as a cross.
{
  const a: (number | null)[] = [1, 2, 3, 4, 5];
  const b: (number | null)[] = [3, 3, 3, 3, 3];
  // a < b at i=0,1; a == b at i=2 (no cross yet); a > b at i=3 (cross here).
  check("no crossover when equal",  crossover(a, b, 2) ===  0);
  check("crossover up at i=3",      crossover(a, b, 3) ===  1);
  check("no re-cross at i=4",       crossover(a, b, 4) ===  0);
  // Reverse direction.
  check("crossover down",           crossover(b, a, 3) === -1);
}

async function liveCheck(): Promise<void> {
console.log("\n[live] BTC-USD over real candles");
const candles = await getCandles("BTC-USD", 60);
const closes  = candles.map((c) => c.close);
console.log(`  ${closes.length} candles, last close = ${closes.at(-1)}`);

const sma20  = sma(closes, 20);
const ema12  = ema(closes, 12);
const r14    = rsi(closes);
const m      = macd(closes);
const bb     = bollinger(closes);

console.log(`  SMA(20)         last = ${lastDefined(sma20)?.toFixed(2)}`);
console.log(`  EMA(12)         last = ${lastDefined(ema12)?.toFixed(2)}`);
console.log(`  RSI(14)         last = ${lastDefined(r14)?.toFixed(2)}`);
console.log(`  MACD            last = ${lastDefined(m.macd)?.toFixed(4)}`);
console.log(`  MACD signal     last = ${lastDefined(m.signal)?.toFixed(4)}`);
console.log(`  MACD histogram  last = ${lastDefined(m.histogram)?.toFixed(4)}`);
console.log(`  Bollinger upper last = ${lastDefined(bb.upper)?.toFixed(2)}`);
console.log(`  Bollinger lower last = ${lastDefined(bb.lower)?.toFixed(2)}`);

// Sanity: RSI must be 0..100, last close must sit between BB lower and upper most of the time.
const rsiLast = lastDefined(r14);
check("rsi in [0,100]", rsiLast !== null && rsiLast >= 0 && rsiLast <= 100, `got ${rsiLast}`);

const lastClose = closes.at(-1) as number;
const bbU = lastDefined(bb.upper) as number;
const bbL = lastDefined(bb.lower) as number;
check("bollinger upper > lower", bbU > bbL);
check("close roughly within ±20% of bb middle",
  approxEqual((lastDefined(bb.middle) as number), lastClose, lastClose * 0.2));
}

liveCheck()
  .then(() => console.log(process.exitCode ? "\n[smoke] FAIL" : "\n[smoke] PASS"))
  .catch((err) => { console.error("[smoke] error:", err); process.exit(2); });
