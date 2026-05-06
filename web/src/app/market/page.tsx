"use client";

/**
 * Market Overview — watchlist of every supported symbol with live
 * last price, 24h change, and a 24h sparkline. Click a row to open
 * that symbol on the Dashboard.
 */

import { WatchlistRow } from "@/components/WatchlistRow";
import { SYMBOLS } from "@/lib/market";

export default function Page() {
  return (
    <div className="space-y-3 max-w-3xl">
      <p className="text-sm text-muted">
        Live watchlist over Coinbase. Click any row to open it on the Dashboard.
      </p>
      <ul className="space-y-3">
        {SYMBOLS.map((s) => (
          <li key={s.id}>
            <WatchlistRow symbol={s} />
          </li>
        ))}
      </ul>
    </div>
  );
}
