"use client";

/**
 * Equity-curve chart for backtest results. Single-pane area series
 * via lightweight-charts. Re-creates the chart on every render of
 * "fresh data" — that's fine because it only runs when the user hits
 * Run, not on every tick.
 */

import { useEffect, useRef } from "react";
import {
  AreaSeries,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { EquityPoint } from "@/lib/backtester";

const CHART_BG   = "#131a23";
const GRID_COLOR = "#1f2937";
const TEXT_MUTED = "#8b949e";
const LINE_UP    = "#06b6d4";

interface Props {
  equity:      EquityPoint[];
  initialCash: number;
}

export function EquityChart({ equity, initialCash }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || equity.length === 0) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background:      { color: CHART_BG },
        textColor:       TEXT_MUTED,
        fontSize:        11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: GRID_COLOR },
        horzLines: { color: GRID_COLOR },
      },
      timeScale:       { borderColor: GRID_COLOR, timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: GRID_COLOR },
      crosshair:       { mode: 1 },
    });
    chartRef.current = chart;

    const series = chart.addSeries(AreaSeries, {
      lineColor:       LINE_UP,
      topColor:        `${LINE_UP}55`,
      bottomColor:     `${LINE_UP}05`,
      lineWidth:       2,
      priceLineVisible: false,
    });

    series.setData(
      equity.map((p) => ({ time: p.time as UTCTimestamp, value: p.equity })),
    );

    // A baseline at the starting cash makes "above water vs underwater"
    // visually obvious without needing a second series.
    series.createPriceLine({
      price:            initialCash,
      color:            "#374151",
      lineWidth:        1,
      lineStyle:        2,                // dashed
      axisLabelVisible: true,
      title:            "start",
    });

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [equity, initialCash]);

  return <div ref={containerRef} className="w-full" style={{ height: 320 }} />;
}
