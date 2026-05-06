"use client";

/**
 * AI Signals card — right-rail card from screenshot 03_1.
 *
 * Renders the active symbol's gpt-4o-mini signal: LONG / SHORT / NEUTRAL
 * pill, confidence bar, target + stop, rationale, and a refresh button
 * with a 10-second cooldown so a recruiter can't accidentally bill the
 * OpenAI route 30 times by mashing the icon.
 *
 * The hook (useSignal) consults a 5-min localStorage cache before any
 * network call, so cards mount instantly when revisiting a symbol the
 * user has already seen.
 */

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Minus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Card } from "./Card";
import { useSignal } from "@/hooks/useSignal";
import {
  type SignalAction,
  type SignalSnapshot,
  type TradingSignal,
} from "@/lib/signals";
import { formatPrice, getSymbol } from "@/lib/market";
import { cn } from "@/lib/cn";

const COOLDOWN_MS = 10_000;

interface Props {
  snapshot: SignalSnapshot | null;
}

export function SignalCard({ snapshot }: Props) {
  const { signal, loading, error, refresh } = useSignal(snapshot);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const onCooldown = cooldownUntil > Date.now();

  function onRefresh() {
    if (onCooldown || loading || !snapshot) return;
    setCooldownUntil(Date.now() + COOLDOWN_MS);
    refresh();
  }

  // Re-render once when the cooldown expires so the button re-enables.
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const t = setTimeout(() => setCooldownUntil(0), cooldownUntil - Date.now());
    return () => clearTimeout(t);
  }, [cooldownUntil]);

  const action = (
    <button
      type="button"
      onClick={onRefresh}
      disabled={loading || onCooldown || !snapshot}
      title={onCooldown ? "Cooldown — wait a moment" : "Refresh signal"}
      className={cn(
        "p-1 rounded hover:bg-elevated transition-colors text-muted hover:text-fg",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
      )}
    >
      {loading
        ? <Loader2 className="size-3.5 animate-spin" />
        : <RefreshCw className="size-3.5" />}
    </button>
  );

  return (
    <Card title={<HeaderTitle />} action={action}>
      {!signal && loading && <SkeletonState />}
      {!signal && error && <ErrorState message={error} retry={onRefresh} />}
      {!signal && !loading && !error && <EmptyState />}
      {signal && <SignalBody sig={signal} />}
    </Card>
  );
}

function HeaderTitle() {
  return (
    <span className="inline-flex items-center gap-2">
      <Sparkles className="size-3.5 text-accent" />
      AI Signals & Analytics
    </span>
  );
}

function SignalBody({ sig }: { sig: TradingSignal }) {
  const sym  = getSymbol(sig.symbol);
  const tone = TONES[sig.action];
  const Icon = tone.icon;

  return (
    <div className={cn("m-3 rounded-md p-4 space-y-3 border", tone.bg, tone.border)}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">{sym?.display ?? sig.symbol}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
            tone.pill,
          )}
        >
          <Icon className="size-3" />
          {sig.action}
        </span>
      </div>

      <div>
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted">Confidence</span>
          <span className="font-mono tabular-nums text-fg">{sig.confidence}%</span>
        </div>
        <div className="mt-1 h-1.5 bg-line rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-[width] duration-500", tone.bar)}
            style={{ width: `${sig.confidence}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 text-xs">
        <div>
          <div className="text-muted">Target</div>
          <div className="font-mono tabular-nums text-fg mt-0.5">
            {formatPrice(sig.target, sym)}
          </div>
        </div>
        <div>
          <div className="text-muted">Stop Loss</div>
          <div className="font-mono tabular-nums text-fg mt-0.5">
            {formatPrice(sig.stopLoss, sym)}
          </div>
        </div>
      </div>

      <p className="text-xs text-fg leading-relaxed border-t border-line/60 pt-3 italic">
        &ldquo;{sig.rationale}&rdquo;
      </p>

      <div className="flex items-center justify-between text-[11px] text-dim">
        <span className="font-mono tabular-nums">
          {new Date(sig.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
        <span>
          {sig.model}
          {sig.tokensIn + sig.tokensOut > 0 && (
            <span className="text-dim"> &middot; {sig.tokensIn + sig.tokensOut}t</span>
          )}
        </span>
      </div>
    </div>
  );
}

function SkeletonState() {
  return (
    <div className="m-3 rounded-md p-4 space-y-3 border border-line bg-elevated/40 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 w-16 bg-line rounded" />
        <div className="h-4 w-14 bg-line rounded-full" />
      </div>
      <div className="space-y-1.5">
        <div className="h-2.5 w-20 bg-line rounded" />
        <div className="h-1.5 w-full bg-line rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-x-4">
        <div className="h-3 w-16 bg-line rounded" />
        <div className="h-3 w-16 bg-line rounded" />
      </div>
      <div className="h-2.5 w-full bg-line rounded" />
    </div>
  );
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="m-3 rounded-md p-4 border border-down/30 bg-down/5 text-xs text-fg">
      <div className="flex items-start gap-2">
        <AlertCircle className="size-4 text-down shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div>
            <div className="font-medium text-down">Signal request failed</div>
            <div className="text-muted mt-1 break-words">{message}</div>
          </div>
          <button
            type="button"
            onClick={retry}
            className="text-accent hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="m-3 rounded-md p-6 border border-line bg-elevated/40 text-center text-xs text-muted">
      Load a chart to generate a signal.
    </div>
  );
}

interface Tone {
  pill:   string;
  bg:     string;
  border: string;
  bar:    string;
  icon:   typeof ArrowUpRight;
}

const TONES: Record<SignalAction, Tone> = {
  long: {
    pill:   "bg-up/20 text-up",
    bg:     "bg-up/5",
    border: "border-up/25",
    bar:    "bg-up",
    icon:   ArrowUpRight,
  },
  short: {
    pill:   "bg-down/20 text-down",
    bg:     "bg-down/5",
    border: "border-down/25",
    bar:    "bg-down",
    icon:   ArrowDownRight,
  },
  neutral: {
    pill:   "bg-warn/20 text-warn",
    bg:     "bg-warn/5",
    border: "border-warn/25",
    bar:    "bg-warn",
    icon:   Minus,
  },
};
