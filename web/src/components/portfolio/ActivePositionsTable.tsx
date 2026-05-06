"use client";

/**
 * Active positions table — matches screenshot 03_3's bottom row.
 * Columns: Symbol | Type | Entry | Current | P/L% | AI Signal bar
 * | Confidence | Risk Score.
 *
 * "AI Signal" column shows a tiny horizontal bar colored by action
 * (long=green, short=red, neutral=amber) with width = confidence%.
 * "Risk Score" is a 0..10 derived from drawdown distance to entry.
 */

import { Card } from "@/components/Card";
import { useTickers } from "@/hooks/useTickers";
import { type Ticker, formatPrice, getSymbol, type ProductId } from "@/lib/market";
import { type PaperAccount, type Position } from "@/lib/paper";
import { type SignalAction, readCachedSignal } from "@/lib/signals";
import { cn } from "@/lib/cn";

interface Props { account: PaperAccount }

export function ActivePositionsTable({ account }: Props) {
  const symbols = account.positions.map((p) => p.symbol);
  const tickers = useTickers(symbols);

  return (
    <Card title="Active Positions & Signals">
      <div className="p-4">
        {account.positions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">
            No open positions. Buy something on the Dashboard to see it here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-dim border-b border-line">
                  <th className="text-left  py-2 px-2">Symbol</th>
                  <th className="text-left  py-2 px-2">Type</th>
                  <th className="text-right py-2 px-2">Entry</th>
                  <th className="text-right py-2 px-2">Current</th>
                  <th className="text-right py-2 px-2">P/L%</th>
                  <th className="text-left  py-2 px-2 w-32">AI Signal</th>
                  <th className="text-left  py-2 px-2">Confidence</th>
                  <th className="text-right py-2 px-2">Risk</th>
                </tr>
              </thead>
              <tbody>
                {account.positions.map((p) => (
                  <Row key={p.symbol} position={p} ticker={tickers.get(p.symbol)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

function Row({ position, ticker }: { position: Position; ticker: Ticker | undefined }) {
  const sym       = getSymbol(position.symbol);
  const last      = ticker?.last ?? position.avgPrice;
  const pnlPct    = (last - position.avgPrice) / position.avgPrice;
  const sig       = readCachedSignal(position.symbol);

  const sigAction: SignalAction = sig?.action ?? "neutral";
  const sigConfidence = sig?.confidence ?? 0;
  const sigBar = SIG_TONES[sigAction];

  // Risk score: how far underwater you are vs. a 5% reference. 0 (safe)
  // to 10 (very stressed). Capped, so a -50% position is still 10.
  const risk = Math.max(0, Math.min(10, Math.round(-pnlPct * 200)));

  return (
    <tr className="border-b border-line/40 hover:bg-elevated/40 transition-colors">
      <td className="py-2 px-2 text-fg font-medium">{sym?.display ?? position.symbol}</td>
      <td className="py-2 px-2">
        <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-up/15 text-up">
          Long
        </span>
      </td>
      <td className="py-2 px-2 text-right font-mono tabular-nums text-muted">
        {formatPrice(position.avgPrice, sym)}
      </td>
      <td className="py-2 px-2 text-right font-mono tabular-nums text-fg">
        {formatPrice(last, sym)}
      </td>
      <td
        className={cn(
          "py-2 px-2 text-right font-mono tabular-nums",
          pnlPct > 0 ? "text-up" : pnlPct < 0 ? "text-down" : "text-muted",
        )}
      >
        {pnlPct >= 0 ? "+" : ""}{(pnlPct * 100).toFixed(2)}%
      </td>
      <td className="py-2 px-2">
        {sig ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 bg-line rounded-full overflow-hidden max-w-24">
              <div
                className={cn("h-full transition-all", sigBar.bar)}
                style={{ width: `${sigConfidence}%` }}
              />
            </div>
            <span className={cn("text-[10px] font-bold uppercase", sigBar.text)}>
              {sigAction}
            </span>
          </div>
        ) : (
          <span className="text-dim text-[11px]">— no signal</span>
        )}
      </td>
      <td className="py-2 px-2 font-mono tabular-nums text-muted">
        {sig ? `${sigConfidence}%` : "—"}
      </td>
      <td className="py-2 px-2 text-right">
        <span
          className={cn(
            "inline-block size-6 leading-6 rounded text-center text-[11px] font-bold",
            risk <= 2 ? "bg-up/15 text-up"
              : risk <= 5 ? "bg-warn/15 text-warn"
              : "bg-down/15 text-down",
          )}
        >
          {risk}
        </span>
      </td>
    </tr>
  );
}

const SIG_TONES: Record<SignalAction, { bar: string; text: string }> = {
  long:    { bar: "bg-up",   text: "text-up"   },
  short:   { bar: "bg-down", text: "text-down" },
  neutral: { bar: "bg-warn", text: "text-warn" },
};
