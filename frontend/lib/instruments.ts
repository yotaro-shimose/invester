import type { Group } from "./api";

export interface BuiltinInstrument {
  slug: string;
  symbol: string; // yfinance ticker
  nameJa: string;
  group: Group;
}

/** Mirrors the backend registry — used by the strategy builder's quick-pick. */
export const BUILTIN_INSTRUMENTS: BuiltinInstrument[] = [
  { slug: "sp500", symbol: "^GSPC", nameJa: "S&P 500", group: "index" },
  { slug: "nasdaq", symbol: "^IXIC", nameJa: "NASDAQ総合", group: "index" },
  { slug: "dow", symbol: "^DJI", nameJa: "ダウ平均", group: "index" },
  { slug: "russell2000", symbol: "^RUT", nameJa: "ラッセル2000", group: "index" },
  { slug: "nikkei", symbol: "^N225", nameJa: "日経225", group: "index" },
  { slug: "ftse", symbol: "^FTSE", nameJa: "FTSE100", group: "index" },
  { slug: "dax", symbol: "^GDAXI", nameJa: "DAX", group: "index" },
  { slug: "hangseng", symbol: "^HSI", nameJa: "ハンセン", group: "index" },
  { slug: "vix", symbol: "^VIX", nameJa: "VIX恐怖指数", group: "index" },
  { slug: "XLK", symbol: "XLK", nameJa: "情報技術", group: "sector" },
  { slug: "XLC", symbol: "XLC", nameJa: "通信サービス", group: "sector" },
  { slug: "XLY", symbol: "XLY", nameJa: "一般消費財", group: "sector" },
  { slug: "XLP", symbol: "XLP", nameJa: "生活必需品", group: "sector" },
  { slug: "XLV", symbol: "XLV", nameJa: "ヘルスケア", group: "sector" },
  { slug: "XLF", symbol: "XLF", nameJa: "金融", group: "sector" },
  { slug: "XLI", symbol: "XLI", nameJa: "資本財", group: "sector" },
  { slug: "XLE", symbol: "XLE", nameJa: "エネルギー", group: "sector" },
  { slug: "XLB", symbol: "XLB", nameJa: "素材", group: "sector" },
  { slug: "XLU", symbol: "XLU", nameJa: "公益", group: "sector" },
  { slug: "XLRE", symbol: "XLRE", nameJa: "不動産", group: "sector" },
];

export const BUILTIN_SYMBOLS = new Set(BUILTIN_INSTRUMENTS.map((i) => i.symbol));
