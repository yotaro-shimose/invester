"use client";

import { useState } from "react";
import type { Allocation, Leg, Strategy } from "@/lib/api";
import { formatJpy } from "@/lib/format";

export interface PickItem {
  symbol: string;
  label: string;
  group: string;
}

export interface StrategyDraft {
  id?: string;
  name: string;
  notes: string;
  initialJpy: number;
  legs: Leg[];
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function aYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return ymd(d);
}

function LegEditor({
  leg,
  index,
  total,
  available,
  initialJpy,
  canRemove,
  isFirst,
  onChange,
  onRemove,
}: {
  leg: Leg;
  index: number;
  total: number;
  available: PickItem[];
  initialJpy: number;
  canRemove: boolean;
  isFirst: boolean;
  onChange: (leg: Leg) => void;
  onRemove: () => void;
}) {
  const [pick, setPick] = useState("");
  const used = new Set(leg.allocations.map((a) => a.symbol));
  const choices = available.filter((a) => !used.has(a.symbol));
  const sumW = leg.allocations.reduce((s, a) => s + a.weight, 0);
  const cashPct = Math.max(0, 100 - sumW);
  const over = sumW > 100;

  function setAllocations(allocations: Allocation[]) {
    onChange({ ...leg, allocations });
  }

  function addPick() {
    const item = available.find((a) => a.symbol === pick);
    if (!item) return;
    setAllocations([
      ...leg.allocations,
      {
        symbol: item.symbol,
        label: item.label,
        weight: Math.min(Math.max(0, 100 - sumW), 20),
      },
    ]);
    setPick("");
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
            {isFirst ? "開始" : `リバランス ${index}`}
          </span>
          <input
            type="date"
            value={leg.date}
            max={ymd(new Date())}
            onChange={(e) => onChange({ ...leg, date: e.target.value })}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
        </div>
        {canRemove && (
          <button
            onClick={onRemove}
            className="text-xs text-zinc-500 transition hover:text-rose-400"
          >
            この日付を削除
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {leg.allocations.map((a) => (
          <div
            key={a.symbol}
            className="flex items-center gap-3 rounded-lg bg-zinc-950/60 px-3 py-1.5"
          >
            <div className="w-36 shrink-0">
              <div className="text-sm font-medium">{a.label}</div>
              <div className="text-xs text-zinc-500">{a.symbol}</div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={a.weight}
              onChange={(e) =>
                setAllocations(
                  leg.allocations.map((x) =>
                    x.symbol === a.symbol
                      ? { ...x, weight: Number(e.target.value) }
                      : x,
                  ),
                )
              }
              className="flex-1 accent-emerald-500"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={a.weight}
              onChange={(e) =>
                setAllocations(
                  leg.allocations.map((x) =>
                    x.symbol === a.symbol
                      ? {
                          ...x,
                          weight: Math.max(0, Math.min(100, Number(e.target.value))),
                        }
                      : x,
                  ),
                )
              }
              className="w-14 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-zinc-500"
            />
            <span className="text-xs text-zinc-500">%</span>
            <button
              onClick={() =>
                setAllocations(leg.allocations.filter((x) => x.symbol !== a.symbol))
              }
              className="text-zinc-500 transition hover:text-rose-400"
              aria-label="削除"
            >
              ✕
            </button>
          </div>
        ))}
        {leg.allocations.length === 0 && (
          <p className="text-xs text-zinc-500">銘柄を追加してください。</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100 outline-none focus:border-zinc-500"
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
            className="rounded-lg bg-zinc-800/60 px-2 py-1 text-zinc-200 transition hover:bg-zinc-700/60 disabled:opacity-50"
          >
            + 追加
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className={over ? "text-rose-400" : "text-zinc-400"}>
            合計 {sumW.toFixed(0)}%{over && " (超過)"}
          </span>
          <span className="text-zinc-500">
            円 {cashPct.toFixed(0)}% ({formatJpy((initialJpy * cashPct) / 100)})
          </span>
        </div>
      </div>
    </div>
  );
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
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [initialJpy, setInitialJpy] = useState(initial?.initialJpy ?? 1_000_000);
  const [legs, setLegs] = useState<Leg[]>(
    initial?.legs?.length
      ? initial.legs
      : [{ date: aYearAgo(), allocations: [] }],
  );

  function setLeg(i: number, leg: Leg) {
    setLegs((prev) => prev.map((l, idx) => (idx === i ? leg : l)));
  }
  function removeLeg(i: number) {
    setLegs((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addLeg() {
    setLegs((prev) => {
      const last = prev[prev.length - 1];
      const nextDate = new Date(last?.date ?? aYearAgo());
      nextDate.setMonth(nextDate.getMonth() + 6);
      const capped = nextDate > new Date() ? new Date() : nextDate;
      return [
        ...prev,
        {
          date: ymd(capped),
          allocations: last ? last.allocations.map((a) => ({ ...a })) : [],
        },
      ];
    });
  }

  const sorted = [...legs].sort((a, b) => a.date.localeCompare(b.date));
  const valid =
    name.trim().length > 0 &&
    legs.length > 0 &&
    legs.every(
      (l) =>
        l.allocations.length > 0 &&
        l.allocations.reduce((s, a) => s + a.weight, 0) <= 100,
    );

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-700 bg-zinc-900/60 p-5">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          戦略名
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: テック強気 → ディフェンシブ"
            className="w-64 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
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

      <label className="flex flex-col gap-1 text-xs text-zinc-400">
        ノート (Markdown対応)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="# 方針&#10;- なぜこの配分か&#10;- いつ動かすか"
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-zinc-500"
        />
      </label>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-300">
            配分タイムライン(各日付で全額を再配分)
          </span>
          <button
            onClick={addLeg}
            className="rounded-lg bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-700/60"
          >
            + リバランス日を追加
          </button>
        </div>
        {legs.map((leg, i) => (
          <LegEditor
            key={i}
            leg={leg}
            index={i}
            total={legs.length}
            available={available}
            initialJpy={initialJpy}
            canRemove={legs.length > 1}
            isFirst={i === 0}
            onChange={(l) => setLeg(i, l)}
            onRemove={() => removeLeg(i)}
          />
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-zinc-800 pt-3">
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
              notes,
              initialJpy,
              legs: sorted,
            })
          }
          disabled={!valid}
          className="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {initial ? "更新" : "保存"}
        </button>
      </div>
    </div>
  );
}
