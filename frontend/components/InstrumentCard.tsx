import Link from "next/link";
import type { InstrumentOverview } from "@/lib/api";
import { formatChange, formatPct, formatPrice, trendClass } from "@/lib/format";
import Sparkline from "./Sparkline";

export default function InstrumentCard({
  item,
  onRemove,
}: {
  item: InstrumentOverview;
  onRemove?: () => void;
}) {
  const up = (item.changePct ?? 0) >= 0;
  const accent = up ? "#10b981" : "#f43f5e";

  return (
    <Link
      href={`/markets/${item.slug}`}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 transition hover:border-zinc-600 hover:bg-zinc-900/80"
    >
      {onRemove && (
        <button
          type="button"
          aria-label="削除"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="absolute right-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full text-zinc-500 opacity-0 transition hover:bg-zinc-700/60 hover:text-zinc-200 group-hover:opacity-100"
        >
          ✕
        </button>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="h-9 w-1.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <div>
            <div className="text-base font-semibold tracking-tight">
              {item.group === "sector" ? item.symbol : item.nameJa}
            </div>
            <div className="text-xs text-zinc-400">
              {item.group === "sector"
                ? item.nameJa
                : item.group === "index"
                  ? item.name
                  : item.symbol}
            </div>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${trendClass(
            item.changePct,
          )} ${up ? "bg-emerald-500/10" : "bg-rose-500/10"}`}
        >
          {formatPct(item.changePct)}
        </span>
      </div>

      <Sparkline data={item.sparkline} color={accent} />

      <div className="flex items-end justify-between">
        <div className="text-2xl font-semibold tabular-nums">
          {formatPrice(item.price)}
        </div>
        <div className={`text-sm tabular-nums ${trendClass(item.change)}`}>
          {formatChange(item.change)}
        </div>
      </div>
    </Link>
  );
}
