"use client";

/**
 * The big chart: candlesticks + EMA + Bollinger overlay in pane 0,
 * RSI in pane 1, MACD line+signal+histogram in pane 2.
 *
 * Strategy:
 *   - Create chart + all 8 series exactly once on mount.
 *   - On every prop change, call setData() per series. lightweight-charts
 *     diffs internally, so a 350-bar setData is microseconds.
 *   - Indicator series are filtered to drop leading nulls (the chart
 *     library expects only points where a value exists).
 *
 * Sizing: `autoSize` lets lightweight-charts handle width changes; we
 * give the wrapper a fixed pixel height so the canvas can compute panes.
 */

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/market";

type Series = (number | null)[];

interface ChartProps {
  candles: Candle[];
  ema12:   Series;
  bbU:     Series;
  bbL:     Series;
  rsi:     Series;
  macd: {
    macd:      Series;
    signal:    Series;
    histogram: Series;
  };
}

const COLORS = {
  up:        "#22c55e",
  down:      "#ef4444",
  ema:       "#fb923c",
  bb:        "rgba(156, 163, 175, 0.55)",
  rsi:       "#06b6d4",
  macdLine:  "#3b82f6",
  macdSig:   "#fb923c",
  rsiLevel:  "#374151",
  textMuted: "#8b949e",
} as const;

const CHART_BG    = "#131a23";
const GRID_COLOR  = "#1f2937";

function toLineData(times: number[], series: Series): { time: UTCTimestamp; value: number }[] {
  const out: { time: UTCTimestamp; value: number }[] = [];
  for (let i = 0; i < series.length; i++) {
    const v = series[i];
    if (v == null) continue;
    out.push({ time: times[i] as UTCTimestamp, value: v });
  }
  return out;
}

export function CandleChart({ candles, ema12, bbU, bbL, rsi, macd }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<{
    candle:   ISeriesApi<"Candlestick">;
    ema:      ISeriesApi<"Line">;
    bbU:      ISeriesApi<"Line">;
    bbL:      ISeriesApi<"Line">;
    rsi:      ISeriesApi<"Line">;
    macdLine: ISeriesApi<"Line">;
    macdSig:  ISeriesApi<"Line">;
    macdHist: ISeriesApi<"Histogram">;
  } | null>(null);

  // ── one-time setup ──────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: CHART_BG },
        textColor:  COLORS.textMuted,
        fontSize:   11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: GRID_COLOR },
        horzLines: { color: GRID_COLOR },
      },
      timeScale: {
        borderColor:  GRID_COLOR,
        timeVisible:  true,
        secondsVisible: false,
      },
      rightPriceScale: { borderColor: GRID_COLOR },
      crosshair: { mode: 1 },
    });
    chartRef.current = chart;

    const candle = chart.addSeries(CandlestickSeries, {
      upColor:        COLORS.up,
      downColor:      COLORS.down,
      borderUpColor:  COLORS.up,
      borderDownColor: COLORS.down,
      wickUpColor:    COLORS.up,
      wickDownColor:  COLORS.down,
    }, 0);

    const ema = chart.addSeries(LineSeries, {
      color:     COLORS.ema,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    }, 0);

    const bbUSer = chart.addSeries(LineSeries, {
      color:     COLORS.bb,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    }, 0);

    const bbLSer = chart.addSeries(LineSeries, {
      color:     COLORS.bb,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    }, 0);

    const rsiSer = chart.addSeries(LineSeries, {
      color:     COLORS.rsi,
      lineWidth: 1,
      priceLineVisible: false,
    }, 1);
    rsiSer.createPriceLine({ price: 70, color: COLORS.rsiLevel, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "70" });
    rsiSer.createPriceLine({ price: 30, color: COLORS.rsiLevel, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "30" });

    const macdLine = chart.addSeries(LineSeries, {
      color:     COLORS.macdLine,
      lineWidth: 1,
      priceLineVisible: false,
    }, 2);
    const macdSig = chart.addSeries(LineSeries, {
      color:     COLORS.macdSig,
      lineWidth: 1,
      priceLineVisible: false,
    }, 2);
    const macdHist = chart.addSeries(HistogramSeries, {
      color: COLORS.up,
      priceLineVisible: false,
    }, 2);

    seriesRef.current = { candle, ema, bbU: bbUSer, bbL: bbLSer, rsi: rsiSer, macdLine, macdSig, macdHist };

    return () => {
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
    };
  }, []);

  // ── repaint on data change ──────────────────────────────────────
  useEffect(() => {
    const s = seriesRef.current;
    if (!s) return;

    const times = candles.map((c) => c.time);

    s.candle.setData(candles.map((c) => ({
      time:  c.time as UTCTimestamp,
      open:  c.open,
      high:  c.high,
      low:   c.low,
      close: c.close,
    })));

    s.ema.setData(toLineData(times, ema12));
    s.bbU.setData(toLineData(times, bbU));
    s.bbL.setData(toLineData(times, bbL));
    s.rsi.setData(toLineData(times, rsi));
    s.macdLine.setData(toLineData(times, macd.macd));
    s.macdSig.setData(toLineData(times, macd.signal));

    // Histogram is colored bar-by-bar based on sign.
    const histData: { time: UTCTimestamp; value: number; color: string }[] = [];
    for (let i = 0; i < macd.histogram.length; i++) {
      const v = macd.histogram[i];
      if (v == null) continue;
      histData.push({
        time:  times[i] as UTCTimestamp,
        value: v,
        color: v >= 0 ? COLORS.up : COLORS.down,
      });
    }
    s.macdHist.setData(histData);
  }, [candles, ema12, bbU, bbL, rsi, macd]);

  return <div ref={containerRef} className="w-full" style={{ height: 520 }} />;
}
