"use client";

import { useCallback, useEffect, useState } from "react";

export interface CustomTicker {
  symbol: string; // yfinance ticker, uppercased
  label: string; // user-facing name
}

export interface StrategyAllocation {
  symbol: string; // yfinance ticker
  label: string; // display name (snapshot at creation time)
  weight: number; // percent of portfolio (0-100)
}

export interface Strategy {
  id: string;
  name: string;
  color: string;
  start: string; // "YYYY-MM-DD"
  initialJpy: number;
  allocations: StrategyAllocation[];
}

const TICKERS_KEY = "invester.customTickers";
const STRATEGIES_KEY = "invester.strategies";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * localStorage-backed state that stays in sync across hook instances (and
 * browser tabs) via a custom event + the native `storage` event.
 */
function useLocalStorage<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    setValue(read(key, fallback));
    const sync = () => setValue(read(key, fallback));
    window.addEventListener("storage", sync);
    window.addEventListener(`ls:${key}`, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(`ls:${key}`, sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
          window.dispatchEvent(new Event(`ls:${key}`));
        } catch {
          /* ignore quota / serialization errors */
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, update] as const;
}

export function useCustomTickers() {
  const [tickers, setTickers] = useLocalStorage<CustomTicker[]>(TICKERS_KEY, []);

  const add = useCallback(
    (ticker: CustomTicker) =>
      setTickers((prev) =>
        prev.some((t) => t.symbol === ticker.symbol)
          ? prev
          : [...prev, ticker],
      ),
    [setTickers],
  );

  const remove = useCallback(
    (symbol: string) =>
      setTickers((prev) => prev.filter((t) => t.symbol !== symbol)),
    [setTickers],
  );

  return { tickers, add, remove };
}

export function useStrategies() {
  const [strategies, setStrategies] = useLocalStorage<Strategy[]>(
    STRATEGIES_KEY,
    [],
  );

  const upsert = useCallback(
    (strategy: Strategy) =>
      setStrategies((prev) => {
        const idx = prev.findIndex((s) => s.id === strategy.id);
        if (idx === -1) return [...prev, strategy];
        const next = [...prev];
        next[idx] = strategy;
        return next;
      }),
    [setStrategies],
  );

  const remove = useCallback(
    (id: string) => setStrategies((prev) => prev.filter((s) => s.id !== id)),
    [setStrategies],
  );

  return { strategies, upsert, remove };
}

let idCounter = 0;
export function newId(): string {
  idCounter += 1;
  return `s_${Date.now().toString(36)}_${idCounter}`;
}
