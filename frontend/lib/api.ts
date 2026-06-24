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

export interface BacktestAllocation {
  symbol: string;
  weight: number; // percent of portfolio (0-100)
}

export interface BacktestPoint {
  time: string;
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
  cashJpy: number;
  points: BacktestPoint[];
}

export async function runBacktest(
  req: {
    allocations: BacktestAllocation[];
    start: string;
    initialJpy?: number;
    refresh?: boolean;
  },
  signal?: AbortSignal,
): Promise<BacktestResult> {
  const res = await fetch(`${API_BASE}/api/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Backtest failed (${res.status})`);
  }
  return res.json();
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
