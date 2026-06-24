"use client";

import { useEffect, useState } from "react";
import {
  fetchPortfolioPerformance,
  type Portfolio,
  type PortfolioInput,
  type PortfolioPerformance,
  type Trade,
} from "@/lib/api";
import { formatJpy, formatPct, trendClass } from "@/lib/format";
import AddTradeForm from "./AddTradeForm";
import Markdown from "./Markdown";
import StrategyComparisonChart from "./StrategyComparisonChart";
import type { PickItem } from "./StrategyBuilder";

function Metric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`tabular-nums ${className ?? ""}`}>{value}</div>
    </div>
  );
}

export default function PortfolioView({
  portfolio,
  available,
  onSave,
  onRemove,
  onAddTrade,
  onDeleteTrade,
}: {
  portfolio: Portfolio;
  available: PickItem[];
  onSave: (input: Partial<PortfolioInput>, id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onAddTrade: (id: string, trade: Trade) => Promise<void>;
  onDeleteTrade: (id: string, tradeId: string) => Promise<void>;
}) {
  const [perf, setPerf] = useState<PortfolioPerformance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(portfolio.name);
  const [notes, setNotes] = useState(portfolio.notes);

  const tradesKey = JSON.stringify(portfolio.trades);

  useEffect(() => {
    if (portfolio.trades.length === 0) {
      setPerf(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetchPortfolioPerformance(portfolio.id, { signal: ctrl.signal })
      .then(setPerf)
      .catch((e) => {
        if (e.name !== "AbortError") setError((e as Error).message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [portfolio.id, tradesKey]);

  const costById = new Map(
    (perf?.tradeDetails ?? []).map((t) => [t.id, t]),
  );

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: portfolio.color }}
          />
          <h2 className="text-lg font-semibold tracking-tight">{portfolio.name}</h2>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <button
            onClick={() => setEditing((v) => !v)}
            className="rounded px-2 py-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            {editing ? "閉じる" : "編集"}
          </button>
          <button
            onClick={() => onRemove(portfolio.id)}
            className="rounded px-2 py-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-rose-400"
          >
            削除
          </button>
        </div>
      </div>

      {editing && (
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="ノート (Markdown対応)"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm outline-none focus:border-zinc-500"
          />
          <div className="flex justify-end">
            <button
              onClick={async () => {
                await onSave({ name: name.trim() || portfolio.name, notes }, portfolio.id);
                setEditing(false);
              }}
              className="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
            >
              保存
            </button>
          </div>
        </div>
      )}

      {error && <div className="text-sm text-rose-400">{error}</div>}

      {perf && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <Metric label="評価額" value={formatJpy(perf.currentValue)} className="text-base font-semibold" />
            <Metric
              label="損益"
              value={`${formatJpy(perf.totalPnl)} (${formatPct(perf.totalReturnPct)})`}
              className={`font-semibold ${trendClass(perf.totalPnl)}`}
            />
            <Metric label="投下資本" value={formatJpy(perf.investedCapital)} className="text-zinc-300" />
            <Metric label="現金" value={formatJpy(perf.cashJpy)} className="text-zinc-300" />
            <Metric label="実現損益" value={formatJpy(perf.realizedPnl)} className={trendClass(perf.realizedPnl)} />
            <Metric label="含み損益" value={formatJpy(perf.unrealizedPnl)} className={trendClass(perf.unrealizedPnl)} />
          </div>

          <div className="h-[300px] rounded-xl border border-zinc-800/80 bg-zinc-950/30 p-2">
            <StrategyComparisonChart
              series={[
                {
                  id: portfolio.id,
                  name: portfolio.name,
                  color: portfolio.color,
                  points: perf.points,
                },
              ]}
            />
          </div>

          {perf.positions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-zinc-500">
                  <tr className="border-b border-zinc-800 text-left">
                    <th className="py-1.5 pr-3">銘柄</th>
                    <th className="py-1.5 pr-3 text-right">株数</th>
                    <th className="py-1.5 pr-3 text-right">平均取得</th>
                    <th className="py-1.5 pr-3 text-right">現在</th>
                    <th className="py-1.5 pr-3 text-right">評価額</th>
                    <th className="py-1.5 text-right">含み損益</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {perf.positions.map((p) => (
                    <tr key={p.symbol} className="border-b border-zinc-800/50">
                      <td className="py-1.5 pr-3">
                        {p.label}{" "}
                        <span className="text-xs text-zinc-500">{p.symbol}</span>
                      </td>
                      <td className="py-1.5 pr-3 text-right">{p.shares.toLocaleString("ja-JP", { maximumFractionDigits: 3 })}</td>
                      <td className="py-1.5 pr-3 text-right text-zinc-400">{formatJpy(p.avgCostJpy)}</td>
                      <td className="py-1.5 pr-3 text-right text-zinc-400">{formatJpy(p.priceJpy)}</td>
                      <td className="py-1.5 pr-3 text-right">{formatJpy(p.valueJpy)}</td>
                      <td className={`py-1.5 text-right ${trendClass(p.unrealizedPnl)}`}>
                        {formatJpy(p.unrealizedPnl)} ({formatPct(p.unrealizedPct)})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-xs text-zinc-500">
            {perf.start} → {perf.end} · 最大DD {perf.maxDrawdownPct.toFixed(1)}%
          </div>
        </>
      )}

      {portfolio.trades.length === 0 && !loading && (
        <p className="text-sm text-zinc-500">
          トレードを追加すると、ここに評価額の推移と損益が表示されます。
        </p>
      )}

      {/* trade log */}
      {portfolio.trades.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs text-zinc-500">トレード履歴</div>
          {[...portfolio.trades]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((t) => {
              const detail = t.id ? costById.get(t.id) : undefined;
              return (
                <div
                  key={t.id ?? `${t.date}-${t.symbol}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-zinc-950/40 px-3 py-1.5 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-zinc-500">{t.date}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        t.side === "buy"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {t.side === "buy" ? "買" : "売"}
                    </span>
                    <span className="font-medium">{t.symbol}</span>
                    <span className="text-zinc-400">
                      {t.mode === "shares"
                        ? `${t.shares}株`
                        : formatJpy(t.amountJpy ?? 0)}
                      {detail && ` · ${detail.shares.toLocaleString("ja-JP", { maximumFractionDigits: 3 })}株 @ ${formatJpy(detail.priceJpy)}`}
                    </span>
                  </div>
                  {t.id && (
                    <button
                      onClick={() => onDeleteTrade(portfolio.id, t.id!)}
                      className="text-zinc-500 transition hover:text-rose-400"
                      aria-label="削除"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}

      <AddTradeForm
        available={available}
        onAdd={(trade) => onAddTrade(portfolio.id, trade)}
      />

      {portfolio.notes.trim() && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <Markdown>{portfolio.notes}</Markdown>
        </div>
      )}
    </div>
  );
}
