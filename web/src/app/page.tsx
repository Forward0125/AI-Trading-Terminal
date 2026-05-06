"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { CandleChart } from "@/components/CandleChart";
import { MarketStrip } from "@/components/MarketStrip";
import { SymbolSwitcher } from "@/components/SymbolSwitcher";
import { useCandles } from "@/hooks/useCandles";
import { bollinger, ema, macd, rsi } from "@/lib/indicators";
import type { ProductId } from "@/lib/market";

export default function Page() {
  const [symbol, setSymbol] = useState<ProductId>("BTC-USD");
  const { candles, loading } = useCandles(symbol, 60);

  // Derive every indicator from `candles.close`. useMemo keeps these
  // stable across re-renders that don't change the underlying array.
  const closes = useMemo(() => candles.map((c) => c.close), [candles]);
  const ema12  = useMemo(() => ema(closes, 12),       [closes]);
  const r14    = useMemo(() => rsi(closes, 14),       [closes]);
  const m      = useMemo(() => macd(closes),          [closes]);
  const bb     = useMemo(() => bollinger(closes, 20, 2), [closes]);

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
        <Card title="AI Signals & Analytics">
          <div className="p-6 text-sm text-muted">Coming step 6</div>
        </Card>
        <Card title="Backtesting Insights">
          <div className="p-6 text-sm text-muted">Coming step 10</div>
        </Card>
      </div>
    </div>
  );
}
