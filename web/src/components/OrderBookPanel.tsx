"use client";

/**
 * Order Book panel — top-N bids and asks for a Coinbase product, with
 * a depth bar per row sized by quantity relative to the largest in
 * view. Asks render top-down (red, ascending), bids render top-down
 * (green, descending), separated by a spread row in the middle.
 *
 * The aggregated book is large (Coinbase aggregates the entire book
 * in level=2), so we always slice top-N before rendering — see the
 * useOrderBook hook for the bookkeeping.
 */

import { Card } from "./Card";
import { useOrderBook } from "@/hooks/useOrderBook";
import { formatPrice, getSymbol, type OrderBook, type ProductId } from "@/lib/market";
import { cn } from "@/lib/cn";

interface Props {
  productId: ProductId;
}

export function OrderBookPanel({ productId }: Props) {
  const { book, loading } = useOrderBook(productId, 12);
  const sym = getSymbol(productId);

  const bestBid  = book.bids[0]?.price;
  const bestAsk  = book.asks[0]?.price;
  const spread   = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;
  const spreadPct = bestBid != null && spread != null ? (spread / bestBid) * 100 : null;

  return (
    <Card
      title="Order Book"
      action={
        <div className="text-[11px] font-mono tabular-nums text-muted">
          {spread != null
            ? <>spread <span className="text-fg">{formatPrice(spread, sym)}</span> <span className="text-dim">({spreadPct?.toFixed(3)}%)</span></>
            : <span className="text-dim">…</span>}
        </div>
      }
    >
      {loading && book.bids.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-muted">Loading book&hellip;</div>
      ) : (
        <BookBody book={book} sym={sym} />
      )}
    </Card>
  );
}

function BookBody({ book, sym }: { book: OrderBook; sym: ReturnType<typeof getSymbol> }) {
  // Scale depth bars to the largest row in view across both sides.
  const maxQty = Math.max(
    1e-9,
    ...book.bids.map((l) => l.quantity),
    ...book.asks.map((l) => l.quantity),
  );

  // Asks are conventionally rendered with the WORST (highest) price at top
  // and the best (lowest) price closest to the spread row. So we reverse.
  const asksTopDown = book.asks.slice().reverse();

  return (
    <div className="px-3 pb-3">
      <Header />
      <div className="mt-1 space-y-px">
        {asksTopDown.map((lvl) => (
          <Row key={`a-${lvl.price}`} side="ask" lvl={lvl} maxQty={maxQty} sym={sym} />
        ))}
      </div>

      <Spread book={book} sym={sym} />

      <div className="mt-0.5 space-y-px">
        {book.bids.map((lvl) => (
          <Row key={`b-${lvl.price}`} side="bid" lvl={lvl} maxQty={maxQty} sym={sym} />
        ))}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-[10px] uppercase tracking-wider text-dim px-2 py-1">
      <span>Price</span>
      <span className="text-right">Size</span>
      <span className="text-right">Total</span>
    </div>
  );
}

function Spread({ book, sym }: { book: OrderBook; sym: ReturnType<typeof getSymbol> }) {
  const bid = book.bids[0]?.price;
  const ask = book.asks[0]?.price;
  if (bid == null || ask == null) return null;
  const mid = (bid + ask) / 2;
  return (
    <div className="my-1 mx-2 px-2 py-1 rounded bg-elevated border border-line text-center text-[11px] text-muted font-mono tabular-nums">
      mid <span className="text-fg">{formatPrice(mid, sym)}</span>
    </div>
  );
}

function Row({
  side,
  lvl,
  maxQty,
  sym,
}: {
  side:    "bid" | "ask";
  lvl:     { price: number; quantity: number };
  maxQty:  number;
  sym:     ReturnType<typeof getSymbol>;
}) {
  const widthPct = Math.max(2, (lvl.quantity / maxQty) * 100);
  const total    = lvl.price * lvl.quantity;

  return (
    <div className="relative grid grid-cols-[1fr_1fr_1fr] gap-2 text-xs font-mono tabular-nums px-2 py-0.5">
      <div
        className={cn(
          "absolute inset-y-0 right-0 rounded-sm",
          side === "bid" ? "bg-up/15" : "bg-down/15",
        )}
        style={{ width: `${widthPct}%` }}
      />
      <span className={cn("relative", side === "bid" ? "text-up" : "text-down")}>
        {formatPrice(lvl.price, sym)}
      </span>
      <span className="relative text-right text-fg">{lvl.quantity.toFixed(4)}</span>
      <span className="relative text-right text-muted">{Math.round(total).toLocaleString()}</span>
    </div>
  );
}
