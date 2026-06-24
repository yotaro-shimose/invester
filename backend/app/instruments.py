"""Tradable instruments we expose: the 11 sector SPDR ETFs and major indices.

Each instrument has a URL-safe ``slug`` (indices use names like ``sp500``
because their yfinance ``symbol`` contains ``^``), a ``group`` so the frontend
can show sectors and indices in separate sections, and a ``currency`` used to
convert prices to JPY for the backtester.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Instrument:
    slug: str
    symbol: str  # yfinance ticker
    name: str
    name_ja: str
    color: str
    group: str  # "sector" | "index"
    currency: str  # native quote currency, e.g. "USD"


SECTORS: list[Instrument] = [
    Instrument("XLK", "XLK", "Information Technology", "情報技術", "#3b82f6", "sector", "USD"),
    Instrument("XLC", "XLC", "Communication Services", "通信サービス", "#8b5cf6", "sector", "USD"),
    Instrument("XLY", "XLY", "Consumer Discretionary", "一般消費財", "#ec4899", "sector", "USD"),
    Instrument("XLP", "XLP", "Consumer Staples", "生活必需品", "#14b8a6", "sector", "USD"),
    Instrument("XLV", "XLV", "Health Care", "ヘルスケア", "#06b6d4", "sector", "USD"),
    Instrument("XLF", "XLF", "Financials", "金融", "#22c55e", "sector", "USD"),
    Instrument("XLI", "XLI", "Industrials", "資本財", "#f59e0b", "sector", "USD"),
    Instrument("XLE", "XLE", "Energy", "エネルギー", "#ef4444", "sector", "USD"),
    Instrument("XLB", "XLB", "Materials", "素材", "#a855f7", "sector", "USD"),
    Instrument("XLU", "XLU", "Utilities", "公益", "#64748b", "sector", "USD"),
    Instrument("XLRE", "XLRE", "Real Estate", "不動産", "#eab308", "sector", "USD"),
]

INDICES: list[Instrument] = [
    Instrument("sp500", "^GSPC", "S&P 500", "S&P 500", "#22c55e", "index", "USD"),
    Instrument("nasdaq", "^IXIC", "Nasdaq Composite", "NASDAQ総合", "#3b82f6", "index", "USD"),
    Instrument("dow", "^DJI", "Dow Jones", "ダウ平均", "#06b6d4", "index", "USD"),
    Instrument("russell2000", "^RUT", "Russell 2000", "ラッセル2000", "#a855f7", "index", "USD"),
    Instrument("nikkei", "^N225", "Nikkei 225", "日経225", "#ef4444", "index", "JPY"),
    Instrument("ftse", "^FTSE", "FTSE 100", "FTSE100", "#f59e0b", "index", "GBP"),
    Instrument("dax", "^GDAXI", "DAX", "DAX", "#eab308", "index", "EUR"),
    Instrument("hangseng", "^HSI", "Hang Seng", "ハンセン", "#ec4899", "index", "HKD"),
    Instrument("vix", "^VIX", "Volatility Index", "VIX恐怖指数", "#f97316", "index", "USD"),
]

ALL: list[Instrument] = SECTORS + INDICES
BY_SLUG: dict[str, Instrument] = {i.slug: i for i in ALL}
BY_SYMBOL: dict[str, Instrument] = {i.symbol: i for i in ALL}

GROUPS: dict[str, list[Instrument]] = {"sector": SECTORS, "index": INDICES}
