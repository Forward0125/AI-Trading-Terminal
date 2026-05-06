/**
 * Hand-rolled technical indicators. Pure functions over numeric series
 * (typically `Candle.close`); no deps. Every function returns an array
 * the same length as the input, with leading `null` entries where there
 * isn't enough lookback yet — `lightweight-charts` skips nulls cleanly.
 *
 *   sma:        simple moving average
 *   ema:        exponential moving average (seeded from initial SMA)
 *   rsi:        Wilder's smoothed RSI on 0..100 scale
 *   macd:       12/26/9 by default; returns macd / signal / histogram
 *   bollinger:  20-period, 2σ bands using population stdev (TA convention)
 *
 * Implementation notes:
 *   - We keep the math obvious; vectorization is unnecessary for the
 *     ~500-bar windows the dashboard renders.
 *   - All functions accept generic `number[]`, not `Candle[]`, so they
 *     compose freely (e.g. EMA-of-MACD for the signal line).
 */

type Series = (number | null)[];

export function sma(values: number[], period: number): Series {
  const out: Series = Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  out[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): Series {
  const out: Series = Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  // Seed with SMA of the first `period` values — standard TA convention.
  let prev = 0;
  for (let i = 0; i < period; i++) prev += values[i];
  prev /= period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function rsi(values: number[], period = 14): Series {
  const out: Series = Array(values.length).fill(null);
  if (values.length <= period) return out;

  let sumGain = 0;
  let sumLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) sumGain += diff; else sumLoss -= diff;
  }
  let avgGain = sumGain / period;
  let avgLoss = sumLoss / period;
  out[period] = rsiFromAverages(avgGain, avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ?  diff : 0;
    const loss = diff < 0 ? -diff : 0;
    // Wilder's smoothing — equivalent to EMA with alpha = 1/period.
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = rsiFromAverages(avgGain, avgLoss);
  }
  return out;
}

function rsiFromAverages(gain: number, loss: number): number {
  if (loss === 0) return 100;          // pure uptrend
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
}

export interface MacdResult {
  macd:      Series;
  signal:    Series;
  histogram: Series;
}

export function macd(
  values:       number[],
  fastPeriod  = 12,
  slowPeriod  = 26,
  signalPeriod = 9,
): MacdResult {
  const fast = ema(values, fastPeriod);
  const slow = ema(values, slowPeriod);
  const macdLine: Series = values.map((_, i) =>
    fast[i] != null && slow[i] != null ? (fast[i] as number) - (slow[i] as number) : null,
  );

  // EMA of macdLine, but only over the contiguous non-null tail.
  const firstIdx   = macdLine.findIndex((v) => v != null);
  const macdValues = firstIdx === -1 ? [] : (macdLine.slice(firstIdx) as number[]);
  const signalTail = ema(macdValues, signalPeriod);
  const signal: Series = Array(values.length).fill(null);
  for (let j = 0; j < signalTail.length; j++) signal[firstIdx + j] = signalTail[j];

  const histogram: Series = values.map((_, i) =>
    macdLine[i] != null && signal[i] != null
      ? (macdLine[i] as number) - (signal[i] as number)
      : null,
  );

  return { macd: macdLine, signal, histogram };
}

export interface BollingerResult {
  middle: Series;
  upper:  Series;
  lower:  Series;
}

export function bollinger(values: number[], period = 20, stdMult = 2): BollingerResult {
  const middle = sma(values, period);
  const upper:  Series = Array(values.length).fill(null);
  const lower:  Series = Array(values.length).fill(null);
  if (values.length < period) return { middle, upper, lower };

  for (let i = period - 1; i < values.length; i++) {
    const mean = middle[i] as number;
    let sqSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = values[j] - mean;
      sqSum += d * d;
    }
    // Population stdev (divide by N) — the TA convention for Bollinger.
    const sd = Math.sqrt(sqSum / period);
    upper[i] = mean + stdMult * sd;
    lower[i] = mean - stdMult * sd;
  }
  return { middle, upper, lower };
}

/** Most-recent non-null value, useful for "current reading" badges. */
export function lastDefined(series: Series): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i];
    if (v != null) return v;
  }
  return null;
}

/** Returns +1 if `a` crossed above `b` at index `i`, -1 if it crossed below,
 *  else 0. Used by the backtester (step 9) for SMA-cross / MACD strategies. */
export function crossover(a: Series, b: Series, i: number): -1 | 0 | 1 {
  if (i <= 0) return 0;
  const a1 = a[i],     b1 = b[i];
  const a0 = a[i - 1], b0 = b[i - 1];
  if (a0 == null || b0 == null || a1 == null || b1 == null) return 0;
  if (a0 <= b0 && a1 >  b1) return  1;
  if (a0 >= b0 && a1 <  b1) return -1;
  return 0;
}
