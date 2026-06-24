export function formatPrice(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatChange(value: number | null | undefined): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

export function formatPct(value: number | null | undefined): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function trendClass(value: number | null | undefined): string {
  if (value == null || value === 0) return "text-zinc-400";
  return value > 0 ? "text-emerald-400" : "text-rose-400";
}

export function formatJpy(value: number | null | undefined): string {
  if (value == null) return "—";
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

export function formatAsOf(asOf: string | null | undefined): string {
  if (!asOf) return "—";
  const d = new Date(asOf);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("ja-JP", { hour12: false });
}
