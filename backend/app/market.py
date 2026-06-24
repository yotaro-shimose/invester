"""yfinance-backed market data with a small force-refreshable TTL cache.

All functions here are synchronous/blocking; FastAPI runs the route handlers
that call them in a threadpool, so they don't block the event loop.

Each cached entry records *when* it was fetched, so responses carry an
``asOf`` timestamp and ``ageSeconds``. Callers can pass ``force=True`` to
bypass the cache and pull fresh data from yfinance on demand.
"""

from __future__ import annotations

import math
import threading
import time
from datetime import datetime, timezone
from typing import Any, Callable

import pandas as pd
import yfinance as yf

from .instruments import BY_SYMBOL, GROUPS, Instrument

# Default accent colors handed to custom (user-added) tickers, by hash.
_CUSTOM_COLORS = [
    "#38bdf8", "#fb7185", "#a3e635", "#c084fc", "#fbbf24",
    "#34d399", "#f472b6", "#60a5fa", "#facc15", "#2dd4bf",
]

# (yfinance period, yfinance interval, whether the interval is intraday)
RANGE_CONFIG: dict[str, tuple[str, str, bool]] = {
    "1D": ("1d", "5m", True),
    "5D": ("5d", "15m", True),
    "1M": ("1mo", "1d", False),
    "6M": ("6mo", "1d", False),
    "1Y": ("1y", "1d", False),
    "5Y": ("5y", "1wk", False),
}

OVERVIEW_TTL = 60.0
HISTORY_TTL = 120.0


class _TTLStore:
    """Thread-safe cache that remembers when each value was produced."""

    def __init__(self, ttl: float) -> None:
        self._ttl = ttl
        self._lock = threading.Lock()
        self._data: dict[str, tuple[float, Any]] = {}

    def get_or_compute(
        self, key: str, producer: Callable[[], Any], force: bool = False
    ) -> tuple[Any, float]:
        """Return (value, fetched_at_epoch). Recompute if forced or stale."""
        now = time.time()
        if not force:
            with self._lock:
                cached = self._data.get(key)
            if cached is not None and now - cached[0] < self._ttl:
                return cached[1], cached[0]
        value = producer()
        fetched_at = time.time()
        with self._lock:
            self._data[key] = (fetched_at, value)
        return value, fetched_at


_overview_store = _TTLStore(OVERVIEW_TTL)
_history_store = _TTLStore(HISTORY_TTL)


def _clean(value: Any) -> float | None:
    """Convert numpy/pandas scalars to a JSON-safe float (or None)."""
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def _freshness(fetched_at: float) -> dict[str, Any]:
    return {
        "asOf": datetime.fromtimestamp(fetched_at, tz=timezone.utc).isoformat(),
        "ageSeconds": round(time.time() - fetched_at, 1),
    }


def _meta(inst: Instrument) -> dict[str, Any]:
    return {
        "slug": inst.slug,
        "symbol": inst.symbol,
        "name": inst.name,
        "nameJa": inst.name_ja,
        "color": inst.color,
        "group": inst.group,
        "currency": inst.currency,
    }


_currency_cache: dict[str, str] = {}


def get_currency(symbol: str) -> str:
    """Native quote currency for any ticker (registry first, then yfinance)."""
    inst = BY_SYMBOL.get(symbol)
    if inst is not None:
        return inst.currency
    if symbol in _currency_cache:
        return _currency_cache[symbol]
    currency = "USD"
    try:
        info = yf.Ticker(symbol).fast_info
        currency = (info.get("currency") or "USD").upper()
    except Exception:
        currency = "USD"
    _currency_cache[symbol] = currency
    return currency


def custom_instrument(symbol: str) -> Instrument:
    """Build a transient Instrument for a user-added ticker not in the registry."""
    color = _CUSTOM_COLORS[sum(ord(c) for c in symbol) % len(_CUSTOM_COLORS)]
    return Instrument(
        slug=symbol,
        symbol=symbol,
        name=symbol,
        name_ja=symbol,
        color=color,
        group="custom",
        currency=get_currency(symbol),
    )


def _extract_close(data: pd.DataFrame | None, symbol: str) -> pd.Series:
    """Pull a symbol's Close series out of a frame in any yfinance layout."""
    empty = pd.Series(dtype=float)
    if data is None or data.empty:
        return empty
    cols = data.columns
    if isinstance(cols, pd.MultiIndex):
        level0 = cols.get_level_values(0)
        level1 = cols.get_level_values(1)
        if symbol in level0:  # group_by="ticker": (TICKER, field)
            sub = data[symbol]
            return sub["Close"].dropna() if "Close" in sub.columns else empty
        if symbol in level1 and "Close" in level0:  # default: (field, TICKER)
            return data["Close"][symbol].dropna()
        if "Close" in level0:  # single ticker, field-only level
            close = data["Close"]
            if isinstance(close, pd.DataFrame):
                close = close.iloc[:, 0]
            return close.dropna()
        return empty
    # single symbol frame
    if "Close" in cols:
        return data["Close"].dropna()
    return empty


def _compute_overview(group: str, range_key: str) -> list[dict[str, Any]]:
    instruments = GROUPS[group]
    period, interval, _ = RANGE_CONFIG[range_key]
    data = yf.download(
        [i.symbol for i in instruments],
        period=period,
        interval=interval,
        group_by="ticker",
        auto_adjust=True,
        progress=False,
        threads=True,
    )

    results: list[dict[str, Any]] = []
    for inst in instruments:
        closes = _extract_close(data, inst.symbol)
        spark = [c for c in (_clean(v) for v in closes.tolist()) if c is not None]

        # Performance over the selected period: first vs last close.
        price = spark[-1] if spark else None
        base = spark[0] if spark else None
        change = price - base if price is not None and base is not None else None
        change_pct = (change / base * 100) if change is not None and base else None

        results.append(
            {
                **_meta(inst),
                "price": price,
                "change": change,
                "changePct": change_pct,
                "sparkline": spark,
            }
        )
    return results


def get_overview(group: str, range_key: str = "1M", force: bool = False) -> dict[str, Any]:
    """Latest price + period return + sparkline for every instrument in a group."""
    instruments, fetched_at = _overview_store.get_or_compute(
        f"{group}:{range_key}",
        lambda: _compute_overview(group, range_key),
        force=force,
    )
    return {
        "group": group,
        "range": range_key,
        "instruments": instruments,
        **_freshness(fetched_at),
    }


def _compute_history(inst: Instrument, range_key: str) -> dict[str, Any]:
    period, interval, intraday = RANGE_CONFIG[range_key]

    df = yf.download(
        inst.symbol,
        period=period,
        interval=interval,
        auto_adjust=True,
        progress=False,
        threads=False,
    )

    candles: list[dict[str, Any]] = []
    if df is None or df.empty:
        return {
            **_meta(inst),
            "range": range_key,
            "interval": interval,
            "intraday": intraday,
            "price": None,
            "change": None,
            "changePct": None,
            "candles": candles,
        }

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    for ts, row in df.iterrows():
        op, hi, lo, cl = (
            _clean(row.get("Open")),
            _clean(row.get("High")),
            _clean(row.get("Low")),
            _clean(row.get("Close")),
        )
        if None in (op, hi, lo, cl):
            continue
        stamp = pd.Timestamp(ts)
        when: Any = int(stamp.timestamp()) if intraday else stamp.strftime("%Y-%m-%d")
        candles.append(
            {
                "time": when,
                "open": op,
                "high": hi,
                "low": lo,
                "close": cl,
                "volume": _clean(row.get("Volume")) or 0,
            }
        )

    first = candles[0]["close"] if candles else None
    last = candles[-1]["close"] if candles else None
    change = last - first if first is not None and last is not None else None
    change_pct = (change / first * 100) if change is not None and first else None

    return {
        **_meta(inst),
        "range": range_key,
        "interval": interval,
        "intraday": intraday,
        "price": last,
        "change": change,
        "changePct": change_pct,
        "candles": candles,
    }


def get_history(inst: Instrument, range_key: str, force: bool = False) -> dict[str, Any]:
    """OHLC candles for one instrument over the requested range."""
    payload, fetched_at = _history_store.get_or_compute(
        f"{inst.slug}:{range_key}",
        lambda: _compute_history(inst, range_key),
        force=force,
    )
    return {**payload, **_freshness(fetched_at)}


def _compute_quotes(symbols: list[str], range_key: str) -> list[dict[str, Any]]:
    period, interval, _ = RANGE_CONFIG[range_key]
    data = yf.download(
        symbols,
        period=period,
        interval=interval,
        group_by="ticker",
        auto_adjust=True,
        progress=False,
        threads=True,
    )

    results: list[dict[str, Any]] = []
    for symbol in symbols:
        inst = BY_SYMBOL.get(symbol) or custom_instrument(symbol)
        closes = _extract_close(data, symbol)
        spark = [c for c in (_clean(v) for v in closes.tolist()) if c is not None]

        price = spark[-1] if spark else None
        base = spark[0] if spark else None
        change = price - base if price is not None and base is not None else None
        change_pct = (change / base * 100) if change is not None and base else None

        results.append(
            {
                **_meta(inst),
                "price": price,
                "change": change,
                "changePct": change_pct,
                "sparkline": spark,
            }
        )
    return results


def get_quotes(symbols: list[str], range_key: str = "1M", force: bool = False) -> dict[str, Any]:
    """Overview cards for arbitrary tickers (user-added dashboard instruments)."""
    ordered = sorted(set(symbols))
    if not ordered:
        return {"range": range_key, "instruments": [], **_freshness(time.time())}
    instruments, fetched_at = _overview_store.get_or_compute(
        f"quotes:{range_key}:{','.join(ordered)}",
        lambda: _compute_quotes(ordered, range_key),
        force=force,
    )
    return {"range": range_key, "instruments": instruments, **_freshness(fetched_at)}
