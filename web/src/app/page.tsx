"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BacktestSummaryCard } from "@/components/BacktestSummaryCard";
import { CandleChart } from "@/components/CandleChart";
import { Card } from "@/components/Card";
import { MarketStrip } from "@/components/MarketStrip";
import { OrderBookPanel } from "@/components/OrderBookPanel";
import { PaperAccountPanel } from "@/components/PaperAccountPanel";
import { SignalCard } from "@/components/SignalCard";
import { SymbolSwitcher } from "@/components/SymbolSwitcher";
import { TradeHistoryPanel } from "@/components/TradeHistoryPanel";
import { useCandles } from "@/hooks/useCandles";
import { bollinger, ema, lastDefined, macd, rsi } from "@/lib/indicators";
import { isSupported, type ProductId } from "@/lib/market";
import type { SignalSnapshot } from "@/lib/signals";

export default function Page() {
  // useSearchParams forces a CSR bailout, so wrap the whole dashboard
  // in a Suspense boundary per Next.js 16 conventions.
  return (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const params  = useSearchParams();
  const initial = params?.get("symbol");
  const [symbol, setSymbol] = useState<ProductId>(
    initial && isSupported(initial) ? initial : "BTC-USD",
  );
  const { candles, loading } = useCandles(symbol, 60);

  // Derive every indicator from `candles.close`. useMemo keeps these
  // stable across re-renders that don't change the underlying array.
  const closes = useMemo(() => candles.map((c) => c.close), [candles]);
  const ema12  = useMemo(() => ema(closes, 12),       [closes]);
  const r14    = useMemo(() => rsi(closes, 14),       [closes]);
  const m      = useMemo(() => macd(closes),          [closes]);
  const bb     = useMemo(() => bollinger(closes, 20, 2), [closes]);

  // Snapshot fed to the AI Signals card. The hook only re-fetches on
  // symbol change, so the per-tick churn here is harmless.
  const signalSnap: SignalSnapshot | null = useMemo(() => {
    if (closes.length === 0) return null;
    return {
      symbol,
      lastClose:  closes[closes.length - 1],
      ema12:      lastDefined(ema12),
      rsi:        lastDefined(r14),
      macd:       lastDefined(m.macd),
      macdSignal: lastDefined(m.signal),
      bbU:        lastDefined(bb.upper),
      bbL:        lastDefined(bb.lower),
    };
  }, [symbol, closes, ema12, r14, m, bb]);

  return (
    <div className="space-y-6">
      <Card
        title={
          <div className="flex flex-wrap items-center gap-4">
            <SymbolSwitcher value={symbol} onChange={setSymbol} />
            <MarketStrip productId={symbol} candles={candles} />
          </div>
        }
      >
        {loading && candles.length === 0 ? (
          <div className="flex items-center justify-center text-muted text-sm" style={{ height: 520 }}>
            Loading {symbol}&hellip;
          </div>
        ) : (
          <CandleChart
            candles={candles}
            ema12={ema12}
            bbU={bb.upper}
            bbL={bb.lower}
            rsi={r14}
            macd={m}
          />
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <OrderBookPanel productId={symbol} />
        <TradeHistoryPanel productId={symbol} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <SignalCard snapshot={signalSnap} />
        <PaperAccountPanel productId={symbol} />
      </div>

      <BacktestSummaryCard />
    </div>
  );
}
