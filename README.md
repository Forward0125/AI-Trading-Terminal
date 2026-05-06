# AI Trading Terminal

Real-time crypto trading dashboard with AI-powered signals, paper trading, and a client-side backtester. Pure browser + Vercel serverless &mdash; zero backend.

**Live demo**: <https://ai-trading-terminal-three.vercel.app/>



## What's in it

| Feature | Where |
|--|--|
| Live candlestick chart with EMA + Bollinger overlay, RSI + MACD subpanels | `/` Dashboard |
| Order book + trade tape (level-2 batch + matches over Coinbase WS) | `/` Dashboard |
| AI Signals card (gpt-4o-mini, strict JSON schema, 5-min localStorage cache) | `/` Dashboard |
| Paper trading: $100k starting cash, market BUY/SELL, weighted-avg cost basis, realized P/L tracking, reset | `/` Dashboard + global Top Bar |
| Backtesting: 3 strategy presets (SMA cross / RSI revert / MACD trend), equity chart, Sharpe / drawdown / win rate, trade list | `/backtesting` |
| Portfolio analytics: KPI strip, allocation, signal alerts feed, risk metrics, active positions table with mini AI signal bars | `/portfolio` |
| Yahoo Finance proxy for AAPL/SPY/TSLA/MSFT/GOOGL/NVDA/AMZN/META | `/api/stocks/{symbol}/klines` (route exists; UI integration deferred to v2) |
| Settings: paper-account stats, reset, cache management | `/settings` |
| Market Overview watchlist with live last + 24h % + sparklines | `/market` |
| AI Signal history timeline (per-browser, last 100) | `/signals` |

## Architecture

| Layer | Tech | Notes |
|---|---|---|
| Frontend | Next.js 16 + React 19 + Tailwind 4 | Deployed to Vercel Hobby |
| Charts | [`lightweight-charts`](https://github.com/tradingview/lightweight-charts) v5 | TradingView's open-source candle library |
| Live crypto data | Coinbase Exchange public REST + WebSocket | Browser-direct, no key, US-friendly. (Binance blocks US IPs.) |
| Stock data | Yahoo Finance v8 chart endpoint via Vercel API route | Yahoo blocks browser CORS, so we proxy. Symbol whitelist enforced. |
| AI signals | gpt-4o-mini via a Vercel API route | Strict JSON-schema response so the model can't hallucinate fields |
| Persistence | `localStorage` | Per-browser paper-trading state, signal cache, last backtest |

**No Render, no Postgres, no auth.** Cold-start cost: zero. Free Vercel Hobby tier covers the whole thing.

## How it stays "browser-native"

- **Real-time**: Coinbase WS pushes ticker, trade tape, and level-2-batch updates straight to the browser. No server in the hot path. A singleton WebSocket client dedups subscriptions across components, so 5 components watching BTC-USD = 1 SUBSCRIBE on the wire.
- **Synthesized candles**: Coinbase has no native kline stream, so we aggregate 1-min OHLCV bars from the trade tape on the client. Same data engine drives the chart, the order book, and the trade history.
- **AI signals**: The Vercel route bills OpenAI on cache miss; a 5-min localStorage TTL on the client keeps requests bounded so a recruiter clicking around won't burn your credit.
- **Backtesting**: Pure-TS engine iterates historical klines client-side. 350 candles \xD7 3 strategies in &lt;10ms.
- **Paper trading**: All positions, cash, and order history live in `localStorage`. Reset is one click. Pub-sub keeps the Top Bar's cash, the dashboard panel, and the portfolio page in sync.

## Local dev

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

Set `OPENAI_API_KEY` in `.env.local` (or the parent `.env` works in CI) for the AI Signals route. Without it, the card shows "Signal request failed: OPENAI_API_KEY not configured".

## Smoke tests

```bash
cd web
npx tsx scripts/smoke-market.ts        # Coinbase REST + WS round-trip
npx tsx scripts/smoke-indicators.ts    # SMA / EMA / RSI / MACD / Bollinger correctness
npx tsx scripts/smoke-orderbook.ts     # level-2 + matches feeds
npx tsx scripts/smoke-paper.ts         # paper-trading store: 29 unit checks
npx tsx scripts/smoke-backtester.ts    # backtester engine
npx tsx scripts/smoke-portfolio.ts     # portfolio math: 23 unit checks
```

Together: ~80 unit checks across the data layer, indicators, paper trading, backtester, and portfolio math.

## Vercel env vars

| Name | Required | Notes |
|---|---|---|
| `OPENAI_API_KEY` | Yes | Server-side only (not `NEXT_PUBLIC_*`). Used by `/api/signals`. |

## Built with

Claude Code &mdash; 12-step rollout, ~30 components, ~3,000 lines of TypeScript across the web app.
