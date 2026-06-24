"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addTrade,
  addWatchlistTicker,
  createPortfolio,
  createStrategy,
  deletePortfolio,
  deleteStrategy,
  fetchPortfolios,
  fetchStrategies,
  fetchWatchlist,
  removeTrade,
  removeWatchlistTicker,
  updatePortfolio,
  updateStrategy,
  type CustomTicker,
  type Portfolio,
  type PortfolioInput,
  type Strategy,
  type StrategyInput,
  type Trade,
} from "./api";

// Re-export domain types so existing imports keep working.
export type { CustomTicker, Portfolio, PortfolioInput, Strategy, StrategyInput, Trade };
export type { Allocation as StrategyAllocation, Leg } from "./api";

/**
 * The watchlist and strategies are persisted on the backend. These hooks load
 * from the API and mutate through it, so the UI and any other caller (e.g. the
 * assistant via curl) share one source of truth. A window event lets multiple
 * mounted hook instances refresh after a mutation.
 */
const WATCHLIST_EVENT = "data:watchlist";
const STRATEGIES_EVENT = "data:strategies";
const PORTFOLIOS_EVENT = "data:portfolios";

function ping(event: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(event));
}

export function useCustomTickers() {
  const [tickers, setTickers] = useState<CustomTicker[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setTickers(await fetchWatchlist());
    } catch {
      /* leave previous state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const onChange = () => reload();
    window.addEventListener(WATCHLIST_EVENT, onChange);
    return () => window.removeEventListener(WATCHLIST_EVENT, onChange);
  }, [reload]);

  const add = useCallback(
    async (symbol: string, label?: string) => {
      await addWatchlistTicker(symbol, label);
      ping(WATCHLIST_EVENT);
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (symbol: string) => {
      await removeWatchlistTicker(symbol);
      ping(WATCHLIST_EVENT);
      await reload();
    },
    [reload],
  );

  return { tickers, loading, add, remove, reload };
}

export function useStrategies() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setStrategies(await fetchStrategies());
    } catch {
      /* leave previous state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const onChange = () => reload();
    window.addEventListener(STRATEGIES_EVENT, onChange);
    return () => window.removeEventListener(STRATEGIES_EVENT, onChange);
  }, [reload]);

  const save = useCallback(
    async (input: StrategyInput, id?: string) => {
      if (id) await updateStrategy(id, input);
      else await createStrategy(input);
      ping(STRATEGIES_EVENT);
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteStrategy(id);
      ping(STRATEGIES_EVENT);
      await reload();
    },
    [reload],
  );

  return { strategies, loading, save, remove, reload };
}

export function usePortfolios() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setPortfolios(await fetchPortfolios());
    } catch {
      /* leave previous state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const onChange = () => reload();
    window.addEventListener(PORTFOLIOS_EVENT, onChange);
    return () => window.removeEventListener(PORTFOLIOS_EVENT, onChange);
  }, [reload]);

  const save = useCallback(
    async (input: Partial<PortfolioInput>, id?: string) => {
      if (id) await updatePortfolio(id, input);
      else await createPortfolio(input as PortfolioInput);
      ping(PORTFOLIOS_EVENT);
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await deletePortfolio(id);
      ping(PORTFOLIOS_EVENT);
      await reload();
    },
    [reload],
  );

  const appendTrade = useCallback(
    async (id: string, trade: Trade) => {
      await addTrade(id, trade);
      ping(PORTFOLIOS_EVENT);
      await reload();
    },
    [reload],
  );

  const deleteTrade = useCallback(
    async (id: string, tradeId: string) => {
      await removeTrade(id, tradeId);
      ping(PORTFOLIOS_EVENT);
      await reload();
    },
    [reload],
  );

  return { portfolios, loading, save, remove, appendTrade, deleteTrade, reload };
}
