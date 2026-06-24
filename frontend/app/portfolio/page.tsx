"use client";

import { useMemo, useState } from "react";
import { BUILTIN_INSTRUMENTS } from "@/lib/instruments";
import { useCustomTickers, usePortfolios } from "@/lib/storage";
import PortfolioView from "@/components/PortfolioView";
import type { PickItem } from "@/components/StrategyBuilder";

export default function PortfolioPage() {
  const { portfolios, save, remove, appendTrade, deleteTrade } = usePortfolios();
  const { tickers } = useCustomTickers();
  const [newName, setNewName] = useState("");

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

  async function createNew() {
    await save({ name: newName.trim() || "ポートフォリオ", notes: "", trades: [] });
    setNewName("");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ポートフォリオ(実トレード)</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            実際のトレードを日付つきで記録し、現在価格でライブ評価。エントリー
            タイミングがそのまま残り、評価額・実現/含み損益を円建て(為替込み)で
            確認できる。買いはその時点で資金投入、売却代金は現金として次の買いに使える。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新規ポートフォリオ名"
            className="w-48 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
          <button
            onClick={createNew}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
          >
            + 作成
          </button>
        </div>
      </div>

      {portfolios.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 p-10 text-center text-sm text-zinc-400">
          まだポートフォリオがありません。名前を入力して「作成」すると、トレードを
          記録できます。任意の銘柄はダッシュボードのウォッチリストに追加すると選べます。
        </div>
      )}

      <div className="flex flex-col gap-6">
        {portfolios.map((p) => (
          <PortfolioView
            key={p.id}
            portfolio={p}
            available={available}
            onSave={save}
            onRemove={remove}
            onAddTrade={appendTrade}
            onDeleteTrade={deleteTrade}
          />
        ))}
      </div>
    </div>
  );
}
