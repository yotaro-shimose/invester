"use client";

import { useEffect, useMemo, useState } from "react";
import { runBacktest, type BacktestResult } from "@/lib/api";
import { formatJpy, formatPct, trendClass } from "@/lib/format";
import { BUILTIN_INSTRUMENTS } from "@/lib/instruments";
import {
  newId,
  useCustomTickers,
  useStrategies,
  type Strategy,
} from "@/lib/storage";
import StrategyBuilder, {
  type PickItem,
  type StrategyDraft,
} from "@/components/StrategyBuilder";
import StrategyComparisonChart from "@/components/StrategyComparisonChart";

const PALETTE = [
  "#34d399", "#60a5fa", "#f472b6", "#fbbf24",
  "#a78bfa", "#f87171", "#22d3ee", "#a3e635",
];

interface RunState {
  loading: boolean;
  result?: BacktestResult;
  error?: string;
}

export default function StrategiesPage() {
  const { strategies, upsert, remove } = useStrategies();
  const { tickers } = useCustomTickers();
  const [results, setResults] = useState<Record<string, RunState>>({});
  const [showBuilder, setShowBuilder] = useState(false);
  const [editing, setEditing] = useState<Strategy | null>(null);

  const available: PickItem[] = useMemo(
    () => [
      ...BUILTIN_INSTRUMENTS.map((i) => ({
        symbol: i.symbol,
        label: i.nameJa,
        group: i.group,
      })),
      ...tickers.map((t) => ({
        symbol: t.symbol,
        label: t.label,
        group: "custom",
      })),
    ],
    [tickers],
  );

  const strategiesKey = JSON.stringify(
    strategies.map((s) => ({
      i: s.id,
      s: s.start,
      j: s.initialJpy,
      a: s.allocations,
    })),
  );

  useEffect(() => {
    let cancelled = false;
    if (strategies.length === 0) {
      setResults({});
      return;
    }
    setResults((prev) => {
      const next: Record<string, RunState> = {};
      for (const s of strategies)
        next[s.id] = { ...prev[s.id], loading: true, error: undefined };
      return next;
    });
    Promise.all(
      strategies.map(async (s) => {
        try {
          const res = await runBacktest({
            allocations: s.allocations.map((a) => ({
              symbol: a.symbol,
              weight: a.weight,
            })),
            start: s.start,
            initialJpy: s.initialJpy,
          });
          if (!cancelled)
            setResults((r) => ({ ...r, [s.id]: { loading: false, result: res } }));
        } catch (e) {
          if (!cancelled)
            setResults((r) => ({
              ...r,
              [s.id]: { loading: false, error: (e as Error).message },
            }));
        }
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [strategiesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave(draft: StrategyDraft) {
    const id = draft.id ?? newId();
    const existing = strategies.find((s) => s.id === id);
    const color = existing?.color ?? PALETTE[strategies.length % PALETTE.length];
    upsert({
      id,
      color,
      name: draft.name,
      start: draft.start,
      initialJpy: draft.initialJpy,
      allocations: draft.allocations,
    });
    setShowBuilder(false);
    setEditing(null);
  }

  const chartSeries = strategies.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    points: results[s.id]?.result?.points ?? [],
  }));
  const hasAnyResult = chartSeries.some((s) => s.points.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">戦略バックテスト</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            銘柄に配分(%)を設定し、残りは円キャッシュで保有。開始日に¥で買い付けて
            そのまま保有(バイ&ホールド)した場合の評価額を、円建て(為替込み)で振り返る。
          </p>
        </div>
        {!showBuilder && (
          <button
            onClick={() => {
              setEditing(null);
              setShowBuilder(true);
            }}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
          >
            + 新規戦略
          </button>
        )}
      </div>

      {showBuilder && (
        <StrategyBuilder
          available={available}
          initial={editing}
          onSave={handleSave}
          onCancel={() => {
            setShowBuilder(false);
            setEditing(null);
          }}
        />
      )}

      {strategies.length === 0 && !showBuilder && (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 p-10 text-center text-sm text-zinc-400">
          まだ戦略がありません。「+ 新規戦略」で作成すると、ここで比較できます。
          <br />
          任意の銘柄を使いたい場合は、先にダッシュボードのウォッチリストに追加してください。
        </div>
      )}

      {strategies.length > 0 && (
        <div className="relative h-[420px] rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3">
          {hasAnyResult ? (
            <StrategyComparisonChart series={chartSeries} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              バックテストを計算中…
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {strategies.map((s) => {
          const run = results[s.id];
          const r = run?.result;
          const totalW = s.allocations.reduce((a, b) => a + b.weight, 0);
          return (
            <div
              key={s.id}
              className="flex flex-col gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <h3 className="font-semibold tracking-tight">{s.name}</h3>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <button
                    onClick={() => {
                      setEditing(s);
                      setShowBuilder(true);
                    }}
                    className="rounded px-2 py-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => remove(s.id)}
                    className="rounded px-2 py-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-rose-400"
                  >
                    削除
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 text-xs text-zinc-400">
                {s.allocations.map((a) => (
                  <span
                    key={a.symbol}
                    className="rounded-full bg-zinc-800/70 px-2 py-0.5"
                  >
                    {a.label} {a.weight}%
                  </span>
                ))}
                {totalW < 100 && (
                  <span className="rounded-full bg-zinc-800/40 px-2 py-0.5 text-zinc-500">
                    円 {(100 - totalW).toFixed(0)}%
                  </span>
                )}
              </div>

              {run?.error ? (
                <div className="text-sm text-rose-400">{run.error}</div>
              ) : r ? (
                <>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-xs text-zinc-500">評価額</div>
                      <div className="text-2xl font-semibold tabular-nums">
                        {formatJpy(r.finalValue)}
                      </div>
                    </div>
                    <div
                      className={`text-lg font-semibold tabular-nums ${trendClass(
                        r.returnPct,
                      )}`}
                    >
                      {formatPct(r.returnPct)}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t border-zinc-800 pt-2 text-center text-xs">
                    <div>
                      <div className="text-zinc-500">年率</div>
                      <div className={`tabular-nums ${trendClass(r.cagrPct)}`}>
                        {formatPct(r.cagrPct)}
                      </div>
                    </div>
                    <div>
                      <div className="text-zinc-500">最大DD</div>
                      <div className="tabular-nums text-rose-400">
                        {r.maxDrawdownPct.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-zinc-500">元本</div>
                      <div className="tabular-nums text-zinc-300">
                        {formatJpy(r.initialJpy)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {r.effectiveStart} → {r.end}
                  </div>
                </>
              ) : (
                <div className="text-sm text-zinc-500">計算中…</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
