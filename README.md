# AI Trading Terminal

Real-time crypto & stock trading dashboard with AI-powered signals, paper trading, and a client-side backtester. Pure browser + Vercel serverless &mdash; zero backend.

## Architecture

| Layer            | Tech                                                      | Notes |
| ---------------- | --------------------------------------------------------- | ----- |
| Frontend         | Next.js 16 + React 19 + Tailwind 4                        | Deployed to Vercel Hobby |
| Charts           | [`lightweight-charts`](https://github.com/tradingview/lightweight-charts) | TradingView's open-source candle library |
| Live crypto data | Coinbase Exchange public REST + WebSocket                 | Browser-direct, no key, US-friendly. (Binance blocks US IPs.) |
| Stock data       | Yahoo Finance v8 chart endpoint, proxied via Vercel route | Yahoo blocks browser CORS |
| AI signals       | OpenAI gpt-4o-mini, called from a Vercel API route        | JSON-schema response, throttled per (symbol, 5-min bucket) |
| Persistence      | `localStorage`                                            | Per-browser paper-trading state |

No Render, no Postgres, no auth. Cold-start cost: zero.

## Status

Step 10 of 12 &mdash; Backtesting page UI (strategy + symbol + granularity picker, equity chart, stats grid, trades table) + dashboard summary card.

> **Vercel env var required:** `OPENAI_API_KEY` (server-side, not `NEXT_PUBLIC_*`). Set it in your Vercel project settings or the card shows "Signal request failed".

See the [12-step plan](#) (lives in conversation history) for the rollout order.

## Local dev

```bash
cd web
npm install
npm run dev
```

Then open <http://localhost:3000>.

## Stack pillars

- **Real-time**: Coinbase WebSocket pushes ticker, trade tape, and level-2 batch updates direct to the browser. No server in the hot path. We synthesize 1-min candles from the trade tape (Coinbase has no native kline stream), which is also why a single connection drives the chart, the trade history, and the order book.
- **AI signals**: A serverless route bills OpenAI on miss; a 5-min `localStorage` TTL on the client keeps requests bounded.
- **Browser-side backtester**: Iterates historical klines client-side. Fast enough for 90-day intraday windows on a modern laptop.
- **Paper trading**: All positions, cash, and order history live in `localStorage`. Reset is one click. No accounts, no signup.
