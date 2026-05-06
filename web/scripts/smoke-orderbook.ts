/**
 * Sanity check that the order-book and recent-trades hooks would
 * receive plausible data. We can't run the React hooks here, but we
 * can verify the underlying lib calls return sensible shapes that the
 * hook would consume.
 *
 * Run: npx tsx scripts/smoke-orderbook.ts
 */

import {
  getOrderBook,
  getRecentTrades,
  subscribeLevel2,
  subscribeTrades,
} from "../src/lib/market/index.ts";

const PRODUCT = "BTC-USD";
const WINDOW_MS = 5_000;

async function main(): Promise<void> {
  console.log("[smoke] REST snapshot");
  const book = await getOrderBook(PRODUCT, 50);
  console.log(`  book: ${book.bids.length} bids / ${book.asks.length} asks`);
  console.log(`  best bid ${book.bids[0]?.price}  best ask ${book.asks[0]?.price}`);
  console.log(`  spread = ${(book.asks[0]?.price - book.bids[0]?.price).toFixed(2)}`);

  const trades = await getRecentTrades(PRODUCT, 5);
  console.log(`  recent trades: ${trades.length}; last side=${trades[0]?.side} price=${trades[0]?.price}`);

  console.log(`\n[smoke] WS for ${WINDOW_MS / 1000}s`);
  let l2 = 0, snap = 0, tr = 0;

  const offBook = subscribeLevel2(PRODUCT, (ev) => {
    if (ev.type === "snapshot") snap++;
    else                        l2 += ev.changes.length;
  });
  const offTr = subscribeTrades(PRODUCT, () => { tr++; });

  await new Promise((r) => setTimeout(r, WINDOW_MS));
  offBook(); offTr();

  console.log(`  l2 snapshots received: ${snap}`);
  console.log(`  l2 individual changes: ${l2}`);
  console.log(`  trades received:       ${tr}`);

  const ok = snap >= 1 && l2 > 0;
  console.log(ok ? "\n[smoke] PASS" : "\n[smoke] FAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => { console.error("[smoke] error:", err); process.exit(2); });
