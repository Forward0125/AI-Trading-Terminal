"use client";

/**
 * AI Signals — append-only timeline of every signal the model has
 * generated for this browser. Gets populated as the user clicks
 * around symbols (the Dashboard's SignalCard fetches on each switch
 * and that fetcher writes here).
 */

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Minus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/Card";
import { useSignalHistory } from "@/hooks/useSignalHistory";
import { clearSignalHistory, type SignalAction, type TradingSignal } from "@/lib/signals";
import { formatPrice, getSymbol } from "@/lib/market";
import { cn } from "@/lib/cn";

export default function Page() {
  const history = useSignalHistory();

  function onClear() {
    if (history.length === 0) return;
    if (window.confirm(`Clear all ${history.length} signal${history.length === 1 ? "" : "s"} from history?`)) {
      clearSignalHistory();
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <Card
        title={
          <span className="inline-flex items-center gap-2">
            <Sparkles className="size-3.5 text-accent" />
            AI Signal History
          </span>
        }
        action={
          history.length > 0
            ? (
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-down transition-colors"
              >
                <Trash2 className="size-3" /> Clear
              </button>
            )
            : null
        }
      >
        <div className="p-4">
          {history.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-3">
              {history.map((sig) => <Row key={`${sig.symbol}:${sig.generatedAt}`} sig={sig} />)}
            </ul>
          )}
        </div>
      </Card>

      {history.length > 0 && (
        <p className="text-[11px] text-dim">
          Showing last {history.length} of {history.length} signals.
          History is per-browser via <code className="text-muted">localStorage</code> &mdash;
          clearing cookies wipes it.
        </p>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-10 text-center text-sm text-muted space-y-3">
      <p>No signals generated yet.</p>
      <p>
        <Link href="/" className="text-accent hover:underline inline-flex items-center gap-1">
          Open the Dashboard <ArrowRight className="size-3" />
        </Link>
        {" "}and the AI Signals card will fetch one on first load.
      </p>
      <p className="text-dim text-[11px]">
        Switch symbols on the chart to populate signals for each market.
      </p>
    </div>
  );
}

function Row({ sig }: { sig: TradingSignal }) {
  const sym  = getSymbol(sig.symbol);
  const tone = TONES[sig.action];
  const Icon = tone.icon;
  return (
    <li className={cn("rounded-md border p-3 grid grid-cols-[auto_1fr] gap-3", tone.bg, tone.border)}>
      <span className={cn("inline-flex items-center justify-center size-8 rounded shrink-0", tone.iconBg)}>
        <Icon className={cn("size-4", tone.text)} />
      </span>
      <div className="space-y-2 min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-fg">{sym?.display ?? sig.symbol}</span>
            <span className={cn("text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded", tone.pill)}>
              {sig.action}
            </span>
            <span className="text-xs text-muted font-mono tabular-nums">{sig.confidence}%</span>
          </div>
          <span className="text-[11px] text-dim font-mono tabular-nums">
            {new Date(sig.generatedAt).toLocaleString([], {
              month:  "short",
              day:    "numeric",
              hour:   "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <p className="text-xs text-fg italic leading-relaxed">&ldquo;{sig.rationale}&rdquo;</p>

        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <Mini label="Entry"  value={formatPrice(sig.lastClose, sym)} />
          <Mini label="Target" value={formatPrice(sig.target,    sym)} />
          <Mini label="Stop"   value={formatPrice(sig.stopLoss,  sym)} />
        </div>

        <div className="flex items-center justify-between text-[10px] text-dim border-t border-line/50 pt-1.5">
          <span>{sig.model} &middot; {sig.tokensIn + sig.tokensOut}t</span>
          <span>~${((sig.tokensIn + sig.tokensOut) * 0.000_000_15 * 1e6 / 1e6).toFixed(5)} per call</span>
        </div>
      </div>
    </li>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-elevated/40 border border-line/50 px-2 py-1">
      <div className="text-dim uppercase tracking-wider">{label}</div>
      <div className="font-mono tabular-nums text-fg mt-0.5">{value}</div>
    </div>
  );
}

interface Tone { bg: string; border: string; pill: string; iconBg: string; text: string; icon: typeof ArrowUpRight }
const TONES: Record<SignalAction, Tone> = {
  long:    { bg: "bg-up/5",   border: "border-up/25",   pill: "bg-up/20 text-up",     iconBg: "bg-up/15",   text: "text-up",   icon: ArrowUpRight   },
  short:   { bg: "bg-down/5", border: "border-down/25", pill: "bg-down/20 text-down", iconBg: "bg-down/15", text: "text-down", icon: ArrowDownRight },
  neutral: { bg: "bg-warn/5", border: "border-warn/25", pill: "bg-warn/20 text-warn", iconBg: "bg-warn/15", text: "text-warn", icon: Minus          },
};

