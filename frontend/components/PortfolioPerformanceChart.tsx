"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import { fetchHistory, type BacktestPoint, type Range } from "@/lib/api";
import { BUILTIN_INSTRUMENTS } from "@/lib/instruments";

const INDICES = BUILTIN_INSTRUMENTS.filter((i) => i.group === "index");
const BASELINE_COLOR = "#94a3b8";

type Mode = "overlay" | "relative";

interface LinePoint {
  time: string;
  value: number;
}
interface ChartLine {
  color: string;
  data: LinePoint[];
  title: string;
}

function pickRange(points: BacktestPoint[]): Range {
  const days =
    (Date.parse(points[points.length - 1].time) - Date.parse(points[0].time)) /
    86_400_000;
  if (days <= 31) return "1M";
  if (days <= 183) return "6M";
  if (days <= 366) return "1Y";
  return "5Y";
}

/** Align a daily baseline close series onto the portfolio's dates (forward-fill). */
function align(
  points: BacktestPoint[],
  baseline: { time: string; close: number }[],
): { time: string; value: number; base: number }[] | null {
  const b = baseline
    .filter((c) => typeof c.time === "string")
    .map((c) => [c.time, c.close] as const);
  let j = 0;
  let last: number | null = null;
  const out: { time: string; value: number; base: number }[] = [];
  for (const p of points) {
    while (j < b.length && b[j][0] <= p.time) {
      last = b[j][1];
      j++;
    }
    out.push({ time: p.time, value: p.value, base: last ?? NaN });
  }
  const first = out.findIndex((o) => !Number.isNaN(o.base));
  if (first < 0) return null;
  return out.slice(first);
}

function LineChart({
  lines,
  percent,
  zeroLine,
}: {
  lines: ChartLine[];
  percent: boolean;
  zeroLine: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
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
        priceFormatter: (p: number) =>
          percent
            ? `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`
            : `¥${Math.round(p).toLocaleString("ja-JP")}`,
      },
    });

    for (const line of lines) {
      if (line.data.length === 0) continue;
      const series = chart.addSeries(LineSeries, {
        color: line.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: line.title,
      });
      series.setData(line.data.map((d) => ({ time: d.time as Time, value: d.value })));
      if (zeroLine) {
        series.createPriceLine({
          price: 0,
          color: "#52525b",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "0%",
        });
      }
    }

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [lines, percent, zeroLine]);

  return <div ref={ref} className="h-full w-full" />;
}

export default function PortfolioPerformanceChart({
  points,
  name,
  color,
}: {
  points: BacktestPoint[];
  name: string;
  color: string;
}) {
  const [baselineSlug, setBaselineSlug] = useState("");
  const [mode, setMode] = useState<Mode>("overlay");
  const [candles, setCandles] = useState<{ time: string; close: number }[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!baselineSlug || points.length === 0) {
      setCandles(null);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setError(null);
    fetchHistory(baselineSlug, pickRange(points), { signal: ctrl.signal })
      .then((h) =>
        setCandles(
          h.candles.map((c) => ({ time: String(c.time), close: c.close })),
        ),
      )
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError("ベースラインの取得に失敗しました。");
          setCandles(null);
        }
      });
    return () => ctrl.abort();
  }, [baselineSlug, points]);

  const baselineName = INDICES.find((i) => i.slug === baselineSlug)?.nameJa ?? "";

  const { lines, percent, zeroLine } = useMemo<{
    lines: ChartLine[];
    percent: boolean;
    zeroLine: boolean;
  }>(() => {
    // No baseline → absolute equity curve (¥).
    if (!baselineSlug || !candles) {
      return {
        lines: [
          { color, title: name, data: points.map((p) => ({ time: p.time, value: p.value })) },
        ],
        percent: false,
        zeroLine: false,
      };
    }
    const aligned = align(points, candles);
    if (!aligned || aligned.length === 0) {
      return {
        lines: [
          { color, title: name, data: points.map((p) => ({ time: p.time, value: p.value })) },
        ],
        percent: false,
        zeroLine: false,
      };
    }
    const v0 = aligned[0].value;
    const b0 = aligned[0].base;
    if (mode === "overlay") {
      return {
        lines: [
          {
            color,
            title: name,
            data: aligned.map((a) => ({ time: a.time, value: (a.value / v0) * 100 })),
          },
          {
            color: BASELINE_COLOR,
            title: baselineName,
            data: aligned.map((a) => ({ time: a.time, value: (a.base / b0) * 100 })),
          },
        ],
        percent: false,
        zeroLine: false,
      };
    }
    // relative: excess return (portfolio growth% − baseline growth%)
    const data = aligned.map((a) => ({
      time: a.time,
      value: (a.value / v0 - a.base / b0) * 100,
    }));
    const finalVal = data[data.length - 1]?.value ?? 0;
    return {
      lines: [
        {
          color: finalVal >= 0 ? "#10b981" : "#f43f5e",
          title: `超過リターン vs ${baselineName}`,
          data,
        },
      ],
      percent: true,
      zeroLine: true,
    };
  }, [points, candles, baselineSlug, baselineName, mode, name, color]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500">ベースライン</span>
        <select
          value={baselineSlug}
          onChange={(e) => setBaselineSlug(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100 outline-none focus:border-zinc-500"
        >
          <option value="">なし(評価額)</option>
          {INDICES.map((i) => (
            <option key={i.slug} value={i.slug}>
              {i.nameJa}
            </option>
          ))}
        </select>
        {baselineSlug && !error && (
          <div className="flex items-center gap-1">
            {(
              [
                ["overlay", "オーバーレイ"],
                ["relative", "相対対比"],
              ] as [Mode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-2 py-1 transition ${
                  mode === m
                    ? "bg-zinc-100 text-zinc-900"
                    : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {baselineSlug && (
          <span className="text-zinc-500">
            {mode === "overlay" ? "起点=100でリベース" : "0%=同等 / 上で勝ち"}
          </span>
        )}
        {error && <span className="text-rose-400">{error}</span>}
      </div>
      <div className="min-h-0 flex-1">
        <LineChart lines={lines} percent={percent} zeroLine={zeroLine} />
      </div>
    </div>
  );
}
