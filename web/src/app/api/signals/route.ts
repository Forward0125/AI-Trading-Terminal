/**
 * POST /api/signals
 *
 * Generates a trading signal from a snapshot of an asset's price + indicators.
 * Calls gpt-4o-mini with strict JSON-schema response_format so the model
 * cannot hallucinate fields. Reads OPENAI_API_KEY from Vercel env.
 *
 * Cost: ~$0.0001 per call. Client-side caches per (symbol, 5-min bucket)
 * in localStorage, so a recruiter clicking around won't trigger more than
 * one call per symbol per 5 minutes.
 */

interface SnapshotBody {
  symbol:      string;
  lastClose:   number;
  ema12:       number | null;
  rsi:         number | null;
  macd:        number | null;
  macdSignal:  number | null;
  bbU:         number | null;
  bbL:         number | null;
}

interface ModelResponse {
  action:     "long" | "short" | "neutral";
  confidence: number;
  target:     number;
  stop_loss:  number;
  rationale:  string;
}

const MODEL = "gpt-4o-mini";
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["action", "confidence", "target", "stop_loss", "rationale"],
  properties: {
    action:     { type: "string",  enum: ["long", "short", "neutral"] },
    confidence: { type: "integer" },
    target:     { type: "number" },
    stop_loss:  { type: "number" },
    rationale:  { type: "string" },
  },
};

const SYSTEM_PROMPT = `You are a quantitative trading assistant. Given a snapshot of an asset's
price + technical indicators, output a single trade signal in the strict JSON
schema provided. Use the playbook below — do NOT invent your own framework.

Playbook (apply in order):

  1. RSI extremes → mean-reversion bias:
     - RSI < 30  → action "long"  (oversold; bounce expected)
     - RSI > 70  → action "short" (overbought; pullback expected)
     - The further past 30/70 (and especially if price is outside Bollinger
       on the same side), the higher the confidence.

  2. RSI is mid-range (30-70) → trend bias from MACD + EMA:
     - MACD > MACD_signal AND last_close > EMA(12) → "long"
     - MACD < MACD_signal AND last_close < EMA(12) → "short"
     - One but not both aligned → still call the direction, lower confidence.

  3. Hard conflicts (e.g. RSI overbought BUT MACD strongly bullish AND price
     above EMA) → "neutral" with confidence 40-55. Never fabricate confidence.

Confidence scale (0-100):
  85-100  multiple indicators clearly align in same direction
  65-84   one strong signal, others mildly supportive
  45-64   tilt one direction with caveats (or "neutral" with conflicting evidence)
  0-44    weak conviction, use only with "neutral"

Target / stop_loss must be sensible non-zero numbers:
  - target  : price 0.5%-3% away from last_close in the action's direction
  - stop_loss: opposite direction at ~HALF the target distance (1:2 R:R)
  - For "neutral": set both equal to last_close.

Rationale: <= 25 words; cite at least one specific indicator reading by value.`;

function fmt(n: number | null, places = 2): string {
  return n == null ? "n/a" : n.toFixed(places);
}

function buildUserPrompt(b: SnapshotBody): string {
  return [
    `Symbol: ${b.symbol}`,
    `Last close: ${fmt(b.lastClose)}`,
    `EMA(12):    ${fmt(b.ema12)}`,
    `RSI(14):    ${fmt(b.rsi)}`,
    `MACD:       ${fmt(b.macd, 4)} (signal ${fmt(b.macdSignal, 4)})`,
    `Bollinger upper: ${fmt(b.bbU)}, lower: ${fmt(b.bbL)}`,
    "",
    "Provide your trading signal.",
  ].join("\n");
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

export async function POST(req: Request): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY not configured on the server" },
      { status: 500 },
    );
  }

  let body: SnapshotBody;
  try {
    body = (await req.json()) as SnapshotBody;
  } catch {
    return Response.json({ error: "request body must be JSON" }, { status: 400 });
  }

  if (typeof body.symbol !== "string" || !isFiniteNumber(body.lastClose)) {
    return Response.json(
      { error: "symbol (string) and lastClose (number) are required" },
      { status: 400 },
    );
  }

  const oai = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:    MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: buildUserPrompt(body) },
      ],
      response_format: {
        type:        "json_schema",
        json_schema: { name: "TradingSignal", schema: SCHEMA, strict: true },
      },
      temperature: 0.3,
    }),
  });

  if (!oai.ok) {
    const detail = (await oai.text()).slice(0, 300);
    return Response.json({ error: `openai ${oai.status}: ${detail}` }, { status: 502 });
  }

  const completion = (await oai.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?:   { prompt_tokens: number; completion_tokens: number };
  };
  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    return Response.json({ error: "openai returned empty completion" }, { status: 502 });
  }

  let parsed: ModelResponse;
  try {
    parsed = JSON.parse(content) as ModelResponse;
  } catch {
    return Response.json({ error: "openai returned non-JSON content" }, { status: 502 });
  }

  return Response.json({
    action:      parsed.action,
    confidence:  clamp(Math.round(parsed.confidence), 0, 100),
    target:      parsed.target,
    stopLoss:    parsed.stop_loss,
    rationale:   parsed.rationale,
    generatedAt: Date.now(),
    model:       MODEL,
    symbol:      body.symbol,
    lastClose:   body.lastClose,
    tokensIn:    completion.usage?.prompt_tokens ?? 0,
    tokensOut:   completion.usage?.completion_tokens ?? 0,
  });
}
