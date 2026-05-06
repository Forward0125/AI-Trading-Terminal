"use client";

/**
 * Paper-trading dashboard panel — replaces the "Backtesting Insights"
 * placeholder in the bottom row. Shows cash + realized P/L + the
 * Buy/Sell buttons for the active symbol, plus a list of open
 * positions with live unrealized P/L per row.
 *
 * Total-value math (cash + Σ position * lastPrice) lives in step 11's
 * Portfolio Dashboard; here we show per-position reads, which already
 * tells the trader what they need to know per row.
 */

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, RotateCcw } from "lucide-react";
import { Card } from "./Card";
import { OrderModal } from "./OrderModal";
import { useTicker } from "@/hooks/useTicker";
import { usePaperAccount } from "@/hooks/usePaperAccount";
import {
  type OrderSide,
  type Position,
  formatUSD,
  resetAccount,
} from "@/lib/paper";
import { formatPrice, getSymbol, type ProductId } from "@/lib/market";
import { cn } from "@/lib/cn";

interface Props {
  productId: ProductId;
}

export function PaperAccountPanel({ productId }: Props) {
  const account = usePaperAccount();
  const [modal, setModal] = useState<{ open: boolean; side: OrderSide }>({ open: false, side: "buy" });

  function open(side: OrderSide) { setModal({ open: true, side }); }
  function close()                { setModal((m) => ({ ...m, open: false })); }

  function onReset() {
    if (window.confirm(
      "Reset paper account to $100,000?\n\nThis clears all open positions and order history. The action can't be undone.",
    )) {
      resetAccount();
    }
  }

  const totalReturn    = account.cash + sumPositionMarketValueZero(account.positions) - account.startingCash;
  const totalReturnPct = (account.realizedPnL / account.startingCash) * 100;

  return (
    <>
      <Card
        title="Paper Account"
        action={
          <button
            type="button"
            onClick={onReset}
            title="Reset paper account"
            className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-fg transition-colors"
          >
            <RotateCcw className="size-3" />
            Reset
          </button>
        }
      >
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <Stat label="Cash"          value={formatUSD(account.cash)} mono />
            <Stat
              label="Realized P/L"
              value={`${account.realizedPnL >= 0 ? "+" : ""}${formatUSD(account.realizedPnL)}`}
              mono
              tone={account.realizedPnL > 0 ? "up" : account.realizedPnL < 0 ? "down" : undefined}
            />
            <Stat
              label="Positions"
              value={String(account.positions.length)}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => open("buy")}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded text-sm font-medium bg-up/15 text-up hover:bg-up/25 transition-colors"
            >
              <ArrowUpRight className="size-3.5" />
              Buy {getSymbol(productId)?.base ?? productId}
            </button>
            <button
              type="button"
              onClick={() => open("sell")}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded text-sm font-medium bg-down/15 text-down hover:bg-down/25 transition-colors"
            >
              <ArrowDownRight className="size-3.5" />
              Sell {getSymbol(productId)?.base ?? productId}
            </button>
          </div>

          <div className="border-t border-line pt-3">
            <div className="text-[11px] uppercase tracking-wider text-dim mb-2">Open positions</div>
            {account.positions.length === 0 ? (
              <p className="text-xs text-muted py-2">No open positions yet. Buy something to get started.</p>
            ) : (
              <ul className="space-y-1">
                {account.positions.map((p) => <PositionRow key={p.symbol} position={p} />)}
              </ul>
            )}
          </div>

          <p className="text-[11px] text-dim border-t border-line pt-2 leading-relaxed">
            Paper trading only. State is per-browser via localStorage; no real funds.
            {totalReturn !== 0 && account.orderHistory.length > 0 && (
              <span> Realized return: {totalReturnPct.toFixed(2)}% of starting capital.</span>
            )}
          </p>
        </div>
      </Card>

      <OrderModal
        open={modal.open}
        side={modal.side}
        productId={productId}
        onClose={close}
      />
    </>
  );
}

function PositionRow({ position }: { position: Position }) {
  const ticker = useTicker(position.symbol);
  const sym    = getSymbol(position.symbol);
  const last   = ticker?.last ?? position.avgPrice;
  const pnl    = position.qty * (last - position.avgPrice);
  const pnlPct = ((last - position.avgPrice) / position.avgPrice) * 100;
  const tone   = pnl > 0 ? "up" : pnl < 0 ? "down" : undefined;

  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-baseline gap-2 text-xs px-2 py-1 rounded hover:bg-elevated/50 transition-colors">
      <span className="font-medium text-fg">{sym?.display ?? position.symbol}</span>
      <span className="font-mono tabular-nums text-muted">
        {position.qty.toFixed(6)} @ {formatPrice(position.avgPrice, sym)}
        <span className="text-dim"> &rarr; </span>
        <span className="text-fg">{formatPrice(last, sym)}</span>
      </span>
      <span
        className={cn(
          "font-mono tabular-nums text-right",
          tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-muted",
        )}
      >
        {pnl >= 0 ? "+" : ""}{formatUSD(pnl)}
        <span className="text-[10px] opacity-70 ml-1">({pnlPct.toFixed(2)}%)</span>
      </span>
    </li>
  );
}

function Stat({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "up" | "down";
}) {
  return (
    <div>
      <div className="text-muted">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-fg",
          mono && "font-mono tabular-nums",
          tone === "up"   && "text-up",
          tone === "down" && "text-down",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/** Placeholder: returns 0 because we don't have live tickers in this
 *  scope. The per-row PositionRow shows live unrealized P/L; the
 *  aggregate total-value math lives in step 11. */
function sumPositionMarketValueZero(_positions: Position[]): number {
  return 0;
}
