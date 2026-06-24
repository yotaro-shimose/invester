"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  RANGES,
  fetchHistory,
  type InstrumentHistory,
  type Range,
} from "@/lib/api";
import {
  formatAsOf,
  formatChange,
  formatPct,
  formatPrice,
  trendClass,
} from "@/lib/format";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import PriceChart from "./PriceChart";

export default function MarketDetail({ slug }: { slug: string }) {
  const [range, setRange] = useState<Range>("1Y");
  const [chartType, setChartType] = useState<"area" | "candles">("area");
  const [data, setData] = useState<InstrumentHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    (rangeKey: Range, opts: { force?: boolean; background?: boolean } = {}) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      if (opts.background) setRefreshing(true);
      else setLoading(true);
      setError(null);
      fetchHistory(slug, rangeKey, { refresh: opts.force, signal: ctrl.signal })
        .then((d) => setData(d))
        .catch((e) => {
          if (e.name !== "AbortError")
            setError("チャートデータを取得できませんでした。");
        })
        .finally(() => {
          if (!ctrl.signal.aborted) {
            setLoading(false);
            setRefreshing(false);
          }
        });
    },
    [slug],
  );

  useEffect(() => {
    load(range);
    return () => abortRef.current?.abort();
  }, [range, load]);

  // Keep the current range fresh on tab focus and on a 60s interval.
  useAutoRefresh(() => load(range, { background: true }), 60_000);

  const accent = data?.color ?? "#10b981";
  const title = data
    ? data.group === "index"
      ? data.nameJa
      : data.symbol
    : slug;
  const subtitle = data
    ? data.group === "index"
      ? data.name
      : `${data.nameJa} · ${data.name}`
    : "";

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/"
        className="w-fit text-sm text-zinc-400 transition hover:text-zinc-100"
      >
        ← 一覧へ戻る
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            className="h-12 w-1.5 rounded-full"
            style={{ backgroundColor: accent }}
          />
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
              {data && (
                <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-xs text-zinc-400">
                  {data.group === "index" ? "指数" : "セクター"}
                </span>
              )}
            </div>
            <div className="text-sm text-zinc-500">{subtitle}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums">
            {formatPrice(data?.price)}
          </div>
          <div className={`text-sm tabular-nums ${trendClass(data?.change)}`}>
            {formatChange(data?.change)} ({formatPct(data?.changePct)}) ·{" "}
            <span className="text-zinc-500">{range}</span>
          </div>
          {data && (
            <div className="mt-0.5 text-xs text-zinc-500">
              最終更新 {formatAsOf(data.asOf)}
              {refreshing && " · 更新中…"}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                range === r
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {(
            [
              ["area", "ライン"],
              ["candles", "ローソク足"],
            ] as ["area" | "candles", string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setChartType(key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                chartType === key
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => load(range, { force: true, background: true })}
            disabled={refreshing}
            className="rounded-lg bg-zinc-800/60 px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700/60 disabled:opacity-50"
          >
            ↻
          </button>
        </div>
      </div>

      <div className="relative h-[460px] rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3">
        {error ? (
          <div className="flex h-full items-center justify-center text-sm text-rose-300">
            {error}
          </div>
        ) : loading && !data ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            読み込み中…
          </div>
        ) : data && data.candles.length > 0 ? (
          <PriceChart
            candles={data.candles}
            intraday={data.intraday}
            color={accent}
            type={chartType}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            データがありません。
          </div>
        )}
      </div>
    </div>
  );
}
