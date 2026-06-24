"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchPortfolioPerformance,
  type PortfolioPerformance,
} from "@/lib/api";
import { formatJpy, formatPct, trendClass } from "@/lib/format";
import { usePortfolios } from "@/lib/storage";
import Markdown from "./Markdown";
import StrategyComparisonChart from "./StrategyComparisonChart";

const SELECTED_KEY = "invester.selectedPortfolio";

function readSelected(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

function NotesBlock({ notes }: { notes: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = notes.trim().length > 160 || notes.split("\n").length > 4;
  if (!notes.trim()) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div
        className={
          !expanded && long ? "relative max-h-24 overflow-hidden" : "relative"
        }
      >
        <Markdown>{notes}</Markdown>
        {!expanded && long && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-zinc-950/80 to-transparent" />
        )}
      </div>
      {long && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs text-emerald-400 transition hover:text-emerald-300"
        >
          {expanded ? "折りたたむ" : "もっと見る"}
        </button>
      )}
    </div>
  );
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`tabular-nums ${className ?? ""}`}>{value}</div>
    </div>
  );
}

export default function PortfolioHero() {
  const { portfolios, loading: listLoading } = usePortfolios();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [perf, setPerf] = useState<PortfolioPerformance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore / validate the persisted selection once portfolios are known.
  useEffect(() => {
    if (portfolios.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => {
      const stored = current ?? readSelected();
      const valid = portfolios.some((p) => p.id === stored);
      return valid ? stored : portfolios[0].id;
    });
  }, [portfolios]);

  function select(id: string) {
    setSelectedId(id);
    try {
      window.localStorage.setItem(SELECTED_KEY, id);
    } catch {
      /* ignore */
    }
  }

  const selected = portfolios.find((p) => p.id === selectedId) ?? null;
  const hasTrades = (selected?.trades.length ?? 0) > 0;

  useEffect(() => {
    if (!selectedId || !hasTrades) {
      setPerf(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetchPortfolioPerformance(selectedId, { signal: ctrl.signal })
      .then(setPerf)
      .catch((e) => {
        if (e.name !== "AbortError") setError((e as Error).message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [selectedId, hasTrades]);

  // 0 portfolios → light entry point, no selector.
  if (!listLoading && portfolios.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 p-5 text-sm text-zinc-400">
        実トレードを記録すると、ここに現在のパフォーマンスが表示されます。{" "}
        <Link href="/portfolio" className="text-emerald-400 hover:text-emerald-300">
          ポートフォリオを作成 →
        </Link>
      </section>
    );
  }

  if (portfolios.length === 0) return null;

  const up = (perf?.totalPnl ?? 0) >= 0;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: selected?.color }}
          />
          <select
            value={selectedId ?? ""}
            onChange={(e) => select(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm font-medium text-zinc-100 outline-none focus:border-zinc-500"
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-zinc-500">マイポートフォリオ</span>
        </div>
        <Link
          href="/portfolio"
          className="text-xs text-zinc-400 transition hover:text-zinc-100"
        >
          管理 →
        </Link>
      </div>

      {selected?.notes?.trim() && <NotesBlock notes={selected.notes} />}

      {!hasTrades ? (
        <div className="text-sm text-zinc-500">
          このポートフォリオにはまだトレードがありません。{" "}
          <Link href="/portfolio" className="text-emerald-400 hover:text-emerald-300">
            トレードを追加 →
          </Link>
        </div>
      ) : error ? (
        <div className="text-sm text-rose-400">
          パフォーマンスを取得できませんでした: {error}
        </div>
      ) : !perf ? (
        <div className="text-sm text-zinc-500">
          {loading ? "評価額を計算中…" : ""}
        </div>
      ) : (
        <>
          {/* hero */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-sm text-zinc-500">現在の評価額</div>
              <div className="text-4xl font-bold tabular-nums sm:text-5xl">
                {formatJpy(perf.currentValue)}
              </div>
            </div>
            <div className={`text-right ${trendClass(perf.totalPnl)}`}>
              <div className="text-2xl font-semibold tabular-nums sm:text-3xl">
                {up ? "▲" : "▼"} {formatJpy(perf.totalPnl)}
              </div>
              <div className="text-lg font-medium tabular-nums">
                {formatPct(perf.totalReturnPct)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-zinc-800 pt-3 sm:grid-cols-4">
            <Metric label="投下元本" value={formatJpy(perf.investedCapital)} className="text-zinc-300" />
            <Metric label="年率" value={formatPct(perf.cagrPct)} className={trendClass(perf.cagrPct)} />
            <Metric label="最大ドローダウン" value={`${perf.maxDrawdownPct.toFixed(1)}%`} className="text-rose-400" />
            <Metric label="評価期間" value={`${perf.start} → ${perf.end}`} className="text-zinc-400 text-sm" />
          </div>

          <div className="h-[260px] rounded-xl border border-zinc-800/80 bg-zinc-950/30 p-2">
            <StrategyComparisonChart
              series={[
                {
                  id: selected!.id,
                  name: selected!.name,
                  color: selected!.color,
                  points: perf.points,
                },
              ]}
            />
          </div>
        </>
      )}
    </section>
  );
}
