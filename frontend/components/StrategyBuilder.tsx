"use client";

import { useMemo, useState } from "react";
import { formatJpy } from "@/lib/format";
import type { Strategy, StrategyAllocation } from "@/lib/storage";

export interface PickItem {
  symbol: string;
  label: string;
  group: string;
}

function defaultStart(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export interface StrategyDraft {
  id?: string;
  name: string;
  start: string;
  initialJpy: number;
  allocations: StrategyAllocation[];
}

export default function StrategyBuilder({
  available,
  initial,
  onSave,
  onCancel,
}: {
  available: PickItem[];
  initial?: Strategy | null;
  onSave: (draft: StrategyDraft) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [start, setStart] = useState(initial?.start ?? defaultStart());
  const [initialJpy, setInitialJpy] = useState(initial?.initialJpy ?? 1_000_000);
  const [allocations, setAllocations] = useState<StrategyAllocation[]>(
    initial?.allocations ?? [],
  );
  const [pick, setPick] = useState("");

  const usedSymbols = new Set(allocations.map((a) => a.symbol));
  const choices = available.filter((a) => !usedSymbols.has(a.symbol));

  const total = useMemo(
    () => allocations.reduce((s, a) => s + a.weight, 0),
    [allocations],
  );
  const cashPct = Math.max(0, 100 - total);
  const cashJpy = (initialJpy * cashPct) / 100;
  const over = total > 100;

  function addPick() {
    const item = available.find((a) => a.symbol === pick);
    if (!item) return;
    const remaining = Math.max(0, 100 - total);
    setAllocations((prev) => [
      ...prev,
      { symbol: item.symbol, label: item.label, weight: Math.min(remaining, 20) },
    ]);
    setPick("");
  }

  function setWeight(symbol: string, weight: number) {
    setAllocations((prev) =>
      prev.map((a) => (a.symbol === symbol ? { ...a, weight } : a)),
    );
  }

  function removeAlloc(symbol: string) {
    setAllocations((prev) => prev.filter((a) => a.symbol !== symbol));
  }

  const canSave = name.trim().length > 0 && allocations.length > 0 && !over;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-700 bg-zinc-900/60 p-5">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          戦略名
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: ハイテク強気"
            className="w-52 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          開始日
          <input
            type="date"
            value={start}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          初期資金 (円)
          <input
            type="number"
            min={1000}
            step={100000}
            value={initialJpy}
            onChange={(e) => setInitialJpy(Number(e.target.value) || 0)}
            className="w-36 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        {allocations.map((a) => (
          <div
            key={a.symbol}
            className="flex items-center gap-3 rounded-lg bg-zinc-950/60 px-3 py-2"
          >
            <div className="w-40 shrink-0">
              <div className="text-sm font-medium">{a.label}</div>
              <div className="text-xs text-zinc-500">{a.symbol}</div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={a.weight}
              onChange={(e) => setWeight(a.symbol, Number(e.target.value))}
              className="flex-1 accent-emerald-500"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={a.weight}
              onChange={(e) =>
                setWeight(a.symbol, Math.max(0, Math.min(100, Number(e.target.value))))
              }
              className="w-16 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-zinc-500"
            />
            <span className="text-sm text-zinc-500">%</span>
            <button
              onClick={() => removeAlloc(a.symbol)}
              className="text-zinc-500 transition hover:text-rose-400"
              aria-label="削除"
            >
              ✕
            </button>
          </div>
        ))}

        {allocations.length === 0 && (
          <p className="text-sm text-zinc-500">
            下のメニューから銘柄を追加して配分を設定してください。
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        >
          <option value="">銘柄を選択…</option>
          {choices.map((c) => (
            <option key={c.symbol} value={c.symbol}>
              {c.label} ({c.symbol})
            </option>
          ))}
        </select>
        <button
          onClick={addPick}
          disabled={!pick}
          className="rounded-lg bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-700/60 disabled:opacity-50"
        >
          + 銘柄を追加
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-3 text-sm">
        <div className="flex items-center gap-4">
          <span className={over ? "text-rose-400" : "text-zinc-300"}>
            配分合計 {total.toFixed(0)}%
            {over && " (100%超過)"}
          </span>
          <span className="text-zinc-500">
            円キャッシュ {cashPct.toFixed(0)}% ({formatJpy(cashJpy)})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:text-zinc-100"
          >
            キャンセル
          </button>
          <button
            onClick={() =>
              onSave({
                id: initial?.id,
                name: name.trim(),
                start,
                initialJpy,
                allocations,
              })
            }
            disabled={!canSave}
            className="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {initial ? "更新" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
