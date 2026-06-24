"use client";

import { useEffect, useRef } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/api";

interface PriceChartProps {
  candles: Candle[];
  intraday: boolean;
  color: string;
  type: "area" | "candles";
}

function toTime(t: string | number): Time {
  return (typeof t === "number" ? (t as UTCTimestamp) : t) as Time;
}

export default function PriceChart({
  candles,
  intraday,
  color,
  type,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart: IChartApi = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a1a1aa",
        fontFamily: "var(--font-geist-sans), sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(63,63,70,0.25)" },
        horzLines: { color: "rgba(63,63,70,0.25)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(63,63,70,0.5)" },
      timeScale: {
        borderColor: "rgba(63,63,70,0.5)",
        timeVisible: intraday,
        secondsVisible: false,
      },
    });

    if (type === "candles") {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#10b981",
        downColor: "#f43f5e",
        borderVisible: false,
        wickUpColor: "#10b981",
        wickDownColor: "#f43f5e",
      });
      series.setData(
        candles.map((c) => ({
          time: toTime(c.time),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );
    } else {
      const series = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: `${color}55`,
        bottomColor: `${color}05`,
        lineWidth: 2,
        priceLineVisible: false,
      });
      series.setData(
        candles.map((c) => ({ time: toTime(c.time), value: c.close })),
      );
    }

    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [candles, intraday, color, type]);

  return <div ref={containerRef} className="h-full w-full" />;
}
