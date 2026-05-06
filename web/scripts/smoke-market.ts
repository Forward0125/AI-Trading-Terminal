/**
 * One-shot smoke test for the market data layer. Run with:
 *   node --experimental-strip-types scripts/smoke-market.ts
 *
 * Exercises:
 *   - getCandles / getTicker / getOrderBook / getRecentTrades (REST)
 *   - subscribeTicker + subscribeTrades + subscribeLevel2 (WS)
 *   - reconnect path is exercised by closing the socket mid-flight (skipped here)
 */

import {
  getCandles,
  getOrderBook,
  getRecentTrades,
  getTicker,
  subscribeLevel2,
  subscribeTicker,
  subscribeTrades,
} from "../src/lib/market/index.ts";

const PRODUCT = "BTC-USD";
const WAIT_MS = 8_000;

async function main(): Promise<void> {
  console.log(`[smoke] REST sanity for ${PRODUCT}`);

  const candles = await getCandles(PRODUCT, 60);
  console.log(`  candles:        ${candles.length} rows; last close = ${candles.at(-1)?.close}`);

  const ticker = await getTicker(PRODUCT);
  console.log(`  ticker:         last ${ticker.last} bid ${ticker.bid} ask ${ticker.ask}`);

  const book = await getOrderBook(PRODUCT);
  console.log(`  order book:     bids ${book.bids.length} asks ${book.asks.length}; top bid ${book.bids[0]?.price}`);

  const trades = await getRecentTrades(PRODUCT, 5);
  console.log(`  recent trades:  ${trades.length} (last side=${trades[0]?.side} price=${trades[0]?.price})`);

  console.log(`\n[smoke] WS sanity (${WAIT_MS / 1000}s window)`);

  const seen = { ticker: 0, trade: 0, l2_snapshot: 0, l2_update: 0 };
  const offT = subscribeTicker(PRODUCT, () => { seen.ticker++; });
  const offM = subscribeTrades(PRODUCT, () => { seen.trade++; });
  const offL = subscribeLevel2(PRODUCT, (ev) => {
    if (ev.type === "snapshot") seen.l2_snapshot++;
    else                        seen.l2_update++;
  });

  await new Promise((r) => setTimeout(r, WAIT_MS));

  offT();
  offM();
  offL();

  console.log(
    `  events received: ticker=${seen.ticker}, trade=${seen.trade}, ` +
    `l2_snapshot=${seen.l2_snapshot}, l2_update=${seen.l2_update}`,
  );

  const ok = seen.ticker > 0 && seen.l2_snapshot > 0 && seen.l2_update > 0;
  console.log(ok ? "\n[smoke] PASS" : "\n[smoke] FAIL — some channels never delivered");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error("[smoke] error:", err);
  process.exit(2);
});
