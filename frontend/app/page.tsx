"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RANGES,
  RANGE_LABELS,
  fetchOverview,
  fetchQuotes,
  type InstrumentOverview,
  type Range,
} from "@/lib/api";
import { formatAsOf } from "@/lib/format";
import { useAutoRefresh } from "@/lib/useAutoRefresh";
import { useCustomTickers } from "@/lib/storage";
import InstrumentCard from "@/components/InstrumentCard";
import AddTickerForm from "@/components/AddTickerForm";

type SortKey = "default" | "gainers" | "losers";

function sortItems(items: InstrumentOverview[], sort: SortKey) {
  const out = [...items];
  if (sort === "gainers")
    out.sort((a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity));
  if (sort === "losers")
    out.sort((a, b) => (a.changePct ?? Infinity) - (b.changePct ?? Infinity));
  return out;
}

function Section({
  title,
  subtitle,
  items,
  sort,
  loading,
  skeletonCount,
}: {
  title: string;
  subtitle: string;
  items: InstrumentOverview[];
  sort: SortKey;
  loading: boolean;
  skeletonCount: number;
}) {
  const advancers = items.filter((s) => (s.changePct ?? 0) > 0).length;
  const decliners = items.filter((s) => (s.changePct ?? 0) < 0).length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-zinc-400">{subtitle}</p>
        </div>
        {!loading && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-emerald-400">▲ {advancers}</span>
            <span className="text-rose-400">▼ {decliners}</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading
          ? Array.from({ length: skeletonCount }).map((_, i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-2xl border border-zinc-800/80 bg-zinc-900/40"
              />
            ))
          : sortItems(items, sort).map((item) => (
              <InstrumentCard key={item.slug} item={item} />
            ))}
      </div>
    </section>
  );
}

export default function Home() {
  const { tickers, remove } = useCustomTickers();
  const [indices, setIndices] = useState<InstrumentOverview[]>([]);
  const [sectors, setSectors] = useState<InstrumentOverview[]>([]);
  const [customItems, setCustomItems] = useState<InstrumentOverview[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("1M");
  const [sort, setSort] = useState<SortKey>("default");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const loadedOnce = useRef(false);
  const tickersRef = useRef(tickers);
  tickersRef.current = tickers;

  const load = useCallback(async (rangeKey: Range, opts: { force?: boolean } = {}) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (loadedOnce.current) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const syms = tickersRef.current.map((t) => t.symbol);
      const [idx, sec, q] = await Promise.all([
        fetchOverview("index", { range: rangeKey, refresh: opts.force }),
        fetchOverview("sector", { range: rangeKey, refresh: opts.force }),
        syms.length
          ? fetchQuotes(syms, { range: rangeKey, refresh: opts.force })
          : Promise.resolve(null),
      ]);
      setIndices(idx.instruments);
      setSectors(sec.instruments);
      setAsOf(sec.asOf);
      const labelBy = new Map(tickersRef.current.map((t) => [t.symbol, t.label]));
      setCustomItems(
        q
          ? q.instruments.map((i) => ({
              ...i,
              nameJa: labelBy.get(i.symbol) ?? i.nameJa,
            }))
          : [],
      );
    } catch {
      setError(
        "データを取得できませんでした。バックエンド (http://localhost:8000) が起動しているか確認してください。",
      );
    } finally {
      inFlight.current = false;
      loadedOnce.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const tickersKey = tickers.map((t) => t.symbol).join(",");
  useEffect(() => {
    load(range);
  }, [range, tickersKey, load]);

  // Re-fetch on tab focus and every 60s while visible, so the view never
  // sits on stale numbers.
  useAutoRefresh(() => load(range), 60_000);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">マーケット概況</h1>
          <p className="mt-1 text-sm text-zinc-400">
            主要指数と米国11セクターの{RANGE_LABELS[range]}騰落率。カードをクリックで詳細チャートへ。
          </p>
        </div>
        <div className="text-right text-xs text-zinc-500">
          最終更新 {formatAsOf(asOf)}
          {refreshing && " · 更新中…"}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs text-zinc-500">期間</span>
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

        <div className="flex items-center gap-1">
          {(
            [
              ["default", "標準"],
              ["gainers", "上昇順"],
              ["losers", "下落順"],
            ] as [SortKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`rounded-full px-3 py-1 text-sm transition ${
                sort === key
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => load(range, { force: true })}
          disabled={refreshing}
          className="ml-auto rounded-full bg-zinc-800/60 px-3 py-1 text-sm text-zinc-300 transition hover:bg-zinc-700/60 disabled:opacity-50"
        >
          ↻ {refreshing ? "更新中…" : "更新"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 text-sm text-rose-300">
          {error}
        </div>
      )}

      {!error && (
        <>
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                ウォッチリスト
              </h2>
              <p className="text-sm text-zinc-400">
                任意のティッカーを追加してダッシュボードと戦略で使える。
              </p>
            </div>
            <AddTickerForm />
            {customItems.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sortItems(customItems, sort).map((item) => (
                  <InstrumentCard
                    key={item.slug}
                    item={item}
                    onRemove={() => remove(item.symbol)}
                  />
                ))}
              </div>
            )}
          </section>

          <Section
            title="主要指数"
            subtitle="米国・日本・欧州・アジアの代表的な株価指数"
            items={indices}
            sort={sort}
            loading={loading}
            skeletonCount={8}
          />
          <Section
            title="セクター"
            subtitle="米国株式市場の11セクター ETF"
            items={sectors}
            sort={sort}
            loading={loading}
            skeletonCount={11}
          />
        </>
      )}
    </div>
  );
}
