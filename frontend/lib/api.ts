export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const RANGES = ["1D", "5D", "1M", "6M", "1Y", "5Y"] as const;
export type Range = (typeof RANGES)[number];

export const RANGE_LABELS: Record<Range, string> = {
  "1D": "1日",
  "5D": "5日",
  "1M": "1ヶ月",
  "6M": "6ヶ月",
  "1Y": "1年",
  "5Y": "5年",
};

export type Group = "sector" | "index" | "custom";

/** URL slugs for every instrument (mirrors the backend registry). */
export const ALL_SLUGS = [
  "XLK",
  "XLC",
  "XLY",
  "XLP",
  "XLV",
  "XLF",
  "XLI",
  "XLE",
  "XLB",
  "XLU",
  "XLRE",
  "sp500",
  "nasdaq",
  "dow",
  "russell2000",
  "nikkei",
  "ftse",
  "dax",
  "hangseng",
  "vix",
] as const;

export interface Freshness {
  /** ISO-8601 UTC timestamp of when the server fetched this data. */
  asOf: string;
  /** Seconds elapsed since the data was fetched, at response time. */
  ageSeconds: number;
}

export interface InstrumentMeta {
  slug: string;
  symbol: string;
  name: string;
  nameJa: string;
  color: string;
  group: Group;
  currency: string;
}

export interface InstrumentOverview extends InstrumentMeta {
  price: number | null;
  change: number | null;
  changePct: number | null;
  sparkline: number[];
}

export interface OverviewResponse extends Freshness {
  group: Group;
  range: Range;
  instruments: InstrumentOverview[];
}

export interface Candle {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface InstrumentHistory extends InstrumentMeta, Freshness {
  range: Range;
  interval: string;
  intraday: boolean;
  price: number | null;
  change: number | null;
  changePct: number | null;
  candles: Candle[];
}

const GROUP_ENDPOINT = {
  sector: "sectors",
  index: "indices",
} as const;

export async function fetchOverview(
  group: keyof typeof GROUP_ENDPOINT,
  opts: { range?: Range; refresh?: boolean; signal?: AbortSignal } = {},
): Promise<OverviewResponse> {
  const params = new URLSearchParams({ range: opts.range ?? "1M" });
  if (opts.refresh) params.set("refresh", "true");
  const res = await fetch(`${API_BASE}/api/${GROUP_ENDPOINT[group]}?${params}`, {
    cache: "no-store",
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`Failed to load ${group} (${res.status})`);
  return res.json();
}

export interface QuotesResponse extends Freshness {
  range: Range;
  instruments: InstrumentOverview[];
}

export async function fetchQuotes(
  symbols: string[],
  opts: { range?: Range; refresh?: boolean; signal?: AbortSignal } = {},
): Promise<QuotesResponse> {
  const params = new URLSearchParams({ range: opts.range ?? "1M" });
  symbols.forEach((s) => params.append("symbols", s));
  if (opts.refresh) params.set("refresh", "true");
  const res = await fetch(`${API_BASE}/api/quotes?${params}`, {
    cache: "no-store",
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`Failed to load quotes (${res.status})`);
  return res.json();
}

// ----- persisted watchlist + strategies (backend is source of truth) -----

export interface CustomTicker {
  symbol: string;
  label: string;
}

export interface Allocation {
  symbol: string;
  label: string;
  weight: number; // percent (0-100)
}

export interface Leg {
  date: string; // "YYYY-MM-DD"
  allocations: Allocation[];
}

export interface Strategy {
  id: string;
  name: string;
  color: string;
  notes: string; // markdown
  initialJpy: number;
  legs: Leg[];
}

export type StrategyInput = Omit<Strategy, "id" | "color"> & {
  color?: string;
};

async function jsonOrThrow(res: Response, what: string) {
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `${what} (${res.status})`);
  }
  return res.json();
}

export async function fetchWatchlist(
  signal?: AbortSignal,
): Promise<CustomTicker[]> {
  const res = await fetch(`${API_BASE}/api/watchlist`, {
    cache: "no-store",
    signal,
  });
  return jsonOrThrow(res, "Failed to load watchlist");
}

export async function addWatchlistTicker(
  symbol: string,
  label?: string,
): Promise<CustomTicker> {
  const res = await fetch(`${API_BASE}/api/watchlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, label }),
  });
  return jsonOrThrow(res, "Failed to add ticker");
}

export async function removeWatchlistTicker(symbol: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/watchlist/${encodeURIComponent(symbol)}`,
    { method: "DELETE" },
  );
  await jsonOrThrow(res, "Failed to remove ticker");
}

export async function fetchStrategies(signal?: AbortSignal): Promise<Strategy[]> {
  const res = await fetch(`${API_BASE}/api/strategies`, {
    cache: "no-store",
    signal,
  });
  return jsonOrThrow(res, "Failed to load strategies");
}

export async function createStrategy(input: StrategyInput): Promise<Strategy> {
  const res = await fetch(`${API_BASE}/api/strategies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(res, "Failed to create strategy");
}

export async function updateStrategy(
  id: string,
  patch: Partial<StrategyInput>,
): Promise<Strategy> {
  const res = await fetch(`${API_BASE}/api/strategies/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return jsonOrThrow(res, "Failed to update strategy");
}

export async function deleteStrategy(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/strategies/${id}`, {
    method: "DELETE",
  });
  await jsonOrThrow(res, "Failed to delete strategy");
}

// ----- backtest ----------------------------------------------------------

export interface BacktestPoint {
  time: string;
  value: number;
}

export interface Rebalance {
  date: string;
  value: number;
}

export interface BacktestResult extends Freshness {
  initialJpy: number;
  finalValue: number;
  returnPct: number;
  maxDrawdownPct: number;
  cagrPct: number;
  effectiveStart: string;
  end: string;
  rebalances: Rebalance[];
  points: BacktestPoint[];
}

export async function runBacktest(
  req: { legs: Leg[]; initialJpy?: number; refresh?: boolean },
  signal?: AbortSignal,
): Promise<BacktestResult> {
  const res = await fetch(`${API_BASE}/api/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    cache: "no-store",
    signal,
  });
  return jsonOrThrow(res, "Backtest failed");
}

// ----- portfolios (actual trade log, persisted) -------------------------

export type TradeSide = "buy" | "sell";
export type TradeMode = "shares" | "amount";

export interface Trade {
  id?: string;
  date: string; // "YYYY-MM-DD"
  symbol: string;
  side: TradeSide;
  mode: TradeMode;
  shares?: number | null;
  amountJpy?: number | null;
  price?: number | null; // native fill price override
}

export interface Portfolio {
  id: string;
  name: string;
  color: string;
  notes: string; // markdown
  trades: Trade[];
}

export type PortfolioInput = Omit<Portfolio, "id" | "color"> & {
  color?: string;
};

export interface Position {
  symbol: string;
  label: string;
  shares: number;
  avgCostJpy: number;
  priceJpy: number;
  valueJpy: number;
  unrealizedPnl: number;
  unrealizedPct: number;
}

export interface TradeDetail {
  id: string | null;
  date: string;
  symbol: string;
  label: string;
  side: TradeSide;
  shares: number;
  priceJpy: number;
  costJpy: number;
}

export interface PortfolioPerformance extends Freshness {
  start: string;
  end: string;
  investedCapital: number;
  currentValue: number;
  cashJpy: number;
  holdingsValue: number;
  totalPnl: number;
  totalReturnPct: number;
  cagrPct: number;
  realizedPnl: number;
  unrealizedPnl: number;
  maxDrawdownPct: number;
  positions: Position[];
  tradeDetails: TradeDetail[];
  points: BacktestPoint[];
}

export async function fetchPortfolios(signal?: AbortSignal): Promise<Portfolio[]> {
  const res = await fetch(`${API_BASE}/api/portfolios`, {
    cache: "no-store",
    signal,
  });
  return jsonOrThrow(res, "Failed to load portfolios");
}

export async function createPortfolio(input: PortfolioInput): Promise<Portfolio> {
  const res = await fetch(`${API_BASE}/api/portfolios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(res, "Failed to create portfolio");
}

export async function updatePortfolio(
  id: string,
  patch: Partial<PortfolioInput>,
): Promise<Portfolio> {
  const res = await fetch(`${API_BASE}/api/portfolios/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return jsonOrThrow(res, "Failed to update portfolio");
}

export async function deletePortfolio(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/portfolios/${id}`, {
    method: "DELETE",
  });
  await jsonOrThrow(res, "Failed to delete portfolio");
}

export async function addTrade(id: string, trade: Trade): Promise<Portfolio> {
  const res = await fetch(`${API_BASE}/api/portfolios/${id}/trades`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trade),
  });
  return jsonOrThrow(res, "Failed to add trade");
}

export async function removeTrade(
  id: string,
  tradeId: string,
): Promise<Portfolio> {
  const res = await fetch(`${API_BASE}/api/portfolios/${id}/trades/${tradeId}`, {
    method: "DELETE",
  });
  return jsonOrThrow(res, "Failed to remove trade");
}

export async function fetchPortfolioPerformance(
  id: string,
  opts: { refresh?: boolean; signal?: AbortSignal } = {},
): Promise<PortfolioPerformance> {
  const qs = opts.refresh ? "?refresh=true" : "";
  const res = await fetch(`${API_BASE}/api/portfolios/${id}/performance${qs}`, {
    cache: "no-store",
    signal: opts.signal,
  });
  return jsonOrThrow(res, "Failed to compute performance");
}

export async function fetchHistory(
  slug: string,
  range: Range,
  opts: { refresh?: boolean; signal?: AbortSignal } = {},
): Promise<InstrumentHistory> {
  const params = new URLSearchParams({ range });
  if (opts.refresh) params.set("refresh", "true");
  const res = await fetch(
    `${API_BASE}/api/markets/${slug}/history?${params}`,
    { cache: "no-store", signal: opts.signal },
  );
  if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
  return res.json();
}
