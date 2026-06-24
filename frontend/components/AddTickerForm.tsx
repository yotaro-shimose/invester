"use client";

import { useState } from "react";
import { BUILTIN_SYMBOLS } from "@/lib/instruments";
import { useCustomTickers } from "@/lib/storage";

export default function AddTickerForm() {
  const { tickers, add } = useCustomTickers();
  const [symbol, setSymbol] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;
    if (BUILTIN_SYMBOLS.has(sym)) {
      setError("この銘柄は既定の一覧にあります。");
      return;
    }
    if (tickers.some((t) => t.symbol === sym)) {
      setError("すでに追加済みです。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await add(sym, label.trim() || undefined);
      setSymbol("");
      setLabel("");
    } catch (err) {
      setError((err as Error).message || "追加に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3"
    >
      <input
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        placeholder="ティッカー (例: AAPL, 7203.T)"
        className="w-44 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
      />
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="表示名 (任意)"
        className="w-40 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
      />
      <button
        type="submit"
        disabled={busy || !symbol.trim()}
        className="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {busy ? "確認中…" : "+ 追加"}
      </button>
      {error && <span className="text-sm text-rose-400">{error}</span>}
    </form>
  );
}
