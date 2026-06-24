"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import type { BacktestPoint } from "@/lib/api";

export interface ChartSeries {
  id: string;
  name: string;
  color: string;
  points: BacktestPoint[];
}

export default function StrategyComparisonChart({
  series,
}: {
  series: ChartSeries[];
}) {
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
      timeScale: { borderColor: "rgba(63,63,70,0.5)" },
      localization: {
        priceFormatter: (p: number) => `¥${Math.round(p).toLocaleString("ja-JP")}`,
      },
    });

    for (const s of series) {
      if (s.points.length === 0) continue;
      const line = chart.addSeries(LineSeries, {
        color: s.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: s.name,
      });
      line.setData(
        s.points.map((p) => ({ time: p.time as Time, value: p.value })),
      );
    }

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [series]);

  return <div ref={containerRef} className="h-full w-full" />;
}
