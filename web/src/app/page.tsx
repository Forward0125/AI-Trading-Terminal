import { Card } from "@/components/Card";

export default function Page() {
  return (
    <div className="space-y-6">
      <Card title="BTC/USD &middot; 1H">
        <div className="aspect-[16/7] flex items-center justify-center text-muted text-sm">
          Candlestick chart &mdash; Binance live ticks land here in step 4
        </div>
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
