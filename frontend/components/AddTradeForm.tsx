"use client";

import { useState } from "react";
import type { Trade, TradeMode, TradeSide } from "@/lib/api";
import type { PickItem } from "./StrategyBuilder";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AddTradeForm({
  available,
  onAdd,
}: {
  available: PickItem[];
  onAdd: (trade: Trade) => Promise<void>;
}) {
  const [date, setDate] = useState(today());
  const [side, setSide] = useState<TradeSide>("buy");
  const [symbol, setSymbol] = useState(available[0]?.symbol ?? "");
  const [mode, setMode] = useState<TradeMode>("shares");
  const [value, setValue] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(value);
    if (!symbol || !num || num <= 0) {
      setError("銘柄と数量を入力してください。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onAdd({
        date,
        symbol,
        side,
        mode,
        shares: mode === "shares" ? num : null,
        amountJpy: mode === "amount" ? num : null,
        price: price ? Number(price) : null,
      });
      setValue("");
      setPrice("");
    } catch (err) {
      setError((err as Error).message || "追加に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3 text-sm"
    >
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        日付
        <input
          type="date"
          value={date}
          max={today()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100 outline-none focus:border-zinc-500"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        売買
        <select
          value={side}
          onChange={(e) => setSide(e.target.value as TradeSide)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100 outline-none focus:border-zinc-500"
        >
          <option value="buy">買い</option>
          <option value="sell">売り</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        銘柄
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100 outline-none focus:border-zinc-500"
        >
          {available.map((a) => (
            <option key={a.symbol} value={a.symbol}>
              {a.label} ({a.symbol})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        単位
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as TradeMode)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100 outline-none focus:border-zinc-500"
        >
          <option value="shares">株数</option>
          <option value="amount">金額(円)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        {mode === "shares" ? "株数" : "金額(円)"}
        <input
          type="number"
          min={0}
          step={mode === "shares" ? "any" : 1000}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-28 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-right tabular-nums text-zinc-100 outline-none focus:border-zinc-500"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        約定価格(任意)
        <input
          type="number"
          min={0}
          step="any"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="既定=終値"
          className="w-28 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-right tabular-nums text-zinc-100 outline-none focus:border-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-emerald-500 px-4 py-1.5 font-medium text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {busy ? "追加中…" : "+ トレード"}
      </button>
      {error && <span className="text-rose-400">{error}</span>}
    </form>
  );
}
