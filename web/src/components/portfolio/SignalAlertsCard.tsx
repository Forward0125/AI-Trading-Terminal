"use client";

/**
 * Reads cached AI signals across all whitelisted symbols and shows
 * the recent ones, sorted newest-first. The cache is 5-min TTL, so
 * this is effectively "what does the AI think *right now* about the
 * symbols you've recently looked at".
 *
 * For an "alerts feed" with longer history we'd need a separate
 * append-only store; that's out of scope for the MVP.
 */

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus, Sparkles, ArrowRight } from "lucide-react";
import { Card } from "@/components/Card";
import {
  type SignalAction,
  type TradingSignal,
  readCachedSignal,
} from "@/lib/signals";
import { SYMBOLS, getSymbol } from "@/lib/market";
import { cn } from "@/lib/cn";

export function SignalAlertsCard() {
  const signals: TradingSignal[] = [];
  for (const s of SYMBOLS) {
    const sig = readCachedSignal(s.id);
    if (sig) signals.push(sig);
  }
  signals.sort((a, b) => b.generatedAt - a.generatedAt);

  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles className="size-3.5 text-accent" />
          AI Signal Alerts
        </span>
      }
    >
      <div className="p-3">
        {signals.length === 0 ? (
          <div className="py-6 px-2 text-center text-xs text-muted space-y-2">
            <p>No cached signals.</p>
            <p>
              <Link href="/" className="text-accent hover:underline inline-flex items-center gap-1">
                Open the Dashboard <ArrowRight className="size-3" />
              </Link>
              {" "}and the AI Signals card auto-fetches one.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {signals.map((sig) => <Row key={sig.symbol + sig.generatedAt} sig={sig} />)}
          </ul>
        )}
      </div>
    </Card>
  );
}

function Row({ sig }: { sig: TradingSignal }) {
  const sym  = getSymbol(sig.symbol);
  const tone = TONES[sig.action];
  const Icon = tone.icon;
  return (
    <li
      className={cn(
        "rounded p-2 border text-xs grid grid-cols-[auto_1fr_auto] items-center gap-2",
        tone.bg,
        tone.border,
      )}
    >
      <span className={cn("inline-flex items-center justify-center size-7 rounded", tone.iconBg)}>
        <Icon className={cn("size-3.5", tone.text)} />
      </span>
      <div className="leading-tight">
        <div>
          <span className="font-medium text-fg">{sym?.display ?? sig.symbol}</span>
          <span className={cn("ml-1.5 text-[10px] uppercase tracking-wider font-bold", tone.text)}>
            {sig.action}
          </span>
        </div>
        <div className="text-[11px] text-muted truncate" title={sig.rationale}>{sig.rationale}</div>
      </div>
      <div className="text-right">
        <div className="font-mono tabular-nums text-fg text-sm">{sig.confidence}%</div>
        <div className="text-[10px] text-dim">{ago(sig.generatedAt)}</div>
      </div>
    </li>
  );
}

interface Tone {
  bg:      string;
  border:  string;
  text:    string;
  iconBg:  string;
  icon:    typeof ArrowUpRight;
}

const TONES: Record<SignalAction, Tone> = {
  long:    { bg: "bg-up/5",   border: "border-up/20",   text: "text-up",   iconBg: "bg-up/15",   icon: ArrowUpRight   },
  short:   { bg: "bg-down/5", border: "border-down/20", text: "text-down", iconBg: "bg-down/15", icon: ArrowDownRight },
  neutral: { bg: "bg-warn/5", border: "border-warn/20", text: "text-warn", iconBg: "bg-warn/15", icon: Minus          },
};

function ago(ms: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (sec < 60)     return `${sec}s`;
  if (sec < 3600)   return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}
