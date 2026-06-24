"""Paper-trading backtester, evaluated in JPY, with mid-course rebalances.

A strategy is a timeline of "legs": each leg has a date and a target
allocation (percent per ticker; the remainder is JPY cash). On each leg date
the whole portfolio is rebuilt to the new allocation at that day's prices —
this is how the portfolio "moves" partway through. A single leg is plain
buy-and-hold. Foreign-currency instruments are converted to JPY using the
matching ``<CCY>JPY=X`` FX series, so the equity curve reflects both market
and currency moves.
"""

from __future__ import annotations

from typing import Any

import pandas as pd
import yfinance as yf

from .market import _TTLStore, _extract_close, _freshness, get_currency

BACKTEST_TTL = 300.0
_backtest_store = _TTLStore(BACKTEST_TTL)


def _fx_to_jpy(currencies: set[str], start: str) -> dict[str, pd.Series]:
    """Return {currency: JPY-per-unit close series} for non-JPY currencies."""
    pairs = {c: f"{c}JPY=X" for c in currencies if c != "JPY"}
    if not pairs:
        return {}
    data = yf.download(
        list(pairs.values()),
        start=start,
        interval="1d",
        auto_adjust=True,
        progress=False,
        threads=True,
    )
    return {cur: _extract_close(data, pair) for cur, pair in pairs.items()}


def _jpy_price_matrix(symbols: list[str], start: str) -> pd.DataFrame:
    """Daily close of every symbol converted to JPY, on a common date index."""
    prices = yf.download(
        symbols,
        start=start,
        interval="1d",
        auto_adjust=True,
        progress=False,
        group_by="ticker",
        threads=True,
    )
    currencies = {s: get_currency(s) for s in symbols}
    missing = [s for s in symbols if _extract_close(prices, s).empty]
    if missing:
        raise ValueError(f"No price data for: {', '.join(missing)}")

    fx = _fx_to_jpy(set(currencies.values()), start)
    jpy = pd.DataFrame()
    for s in symbols:
        native = _extract_close(prices, s)
        cur = currencies[s]
        if cur == "JPY":
            jpy[s] = native
        else:
            rate = fx[cur].reindex(native.index).ffill().bfill()
            jpy[s] = native * rate

    jpy = jpy.dropna()
    if jpy.empty:
        raise ValueError("No overlapping price history for the chosen tickers/date.")
    return jpy


def _compute(legs: list[dict[str, Any]], initial_jpy: float) -> dict[str, Any]:
    if not legs:
        raise ValueError("Strategy has no legs.")

    legs_sorted = sorted(legs, key=lambda leg: leg["date"])
    symbols = sorted(
        {a["symbol"] for leg in legs_sorted for a in leg["allocations"]}
    )
    if not symbols:
        raise ValueError("Strategy has no allocations.")

    start = legs_sorted[0]["date"]
    jpy = _jpy_price_matrix(symbols, start)
    dates = jpy.index
    n = len(dates)

    # Map each leg to the first available trading day on/after its date.
    items: list[tuple[int, dict[str, Any]]] = []
    for leg in legs_sorted:
        pos = int(dates.searchsorted(pd.Timestamp(leg["date"]), side="left"))
        if pos >= n:
            continue  # leg starts after the data ends; ignore
        items.append((pos, leg))
    if not items:
        raise ValueError("No trading days available for the chosen dates.")

    value = pd.Series(index=dates, dtype=float)
    holdings: dict[str, float] = {}
    cash = 0.0
    rebalances: list[dict[str, Any]] = []

    for k, (pos, leg) in enumerate(items):
        end = items[k + 1][0] if k + 1 < len(items) else n
        if k == 0:
            portfolio_value = initial_jpy
        else:
            portfolio_value = cash + sum(
                units * float(jpy[sym].iloc[pos]) for sym, units in holdings.items()
            )

        weights = {a["symbol"]: float(a["weight"]) / 100.0 for a in leg["allocations"]}
        sum_w = sum(weights.values())
        cash = portfolio_value * (1.0 - sum_w)
        holdings = {
            sym: (portfolio_value * w) / float(jpy[sym].iloc[pos])
            for sym, w in weights.items()
        }
        rebalances.append(
            {
                "date": dates[pos].strftime("%Y-%m-%d"),
                "value": portfolio_value,
            }
        )

        if end > pos:
            segment = jpy.iloc[pos:end]
            seg_value = pd.Series(cash, index=segment.index)
            for sym, units in holdings.items():
                seg_value = seg_value + units * segment[sym]
            value.iloc[pos:end] = seg_value

    value = value.dropna()
    if value.empty:
        raise ValueError("Backtest produced no data points.")

    points = [
        {"time": pd.Timestamp(ts).strftime("%Y-%m-%d"), "value": float(v)}
        for ts, v in value.items()
    ]
    final = points[-1]["value"]
    return_pct = (final / initial_jpy - 1.0) * 100.0

    running_max = value.cummax()
    drawdown = (value / running_max - 1.0) * 100.0
    max_drawdown = float(drawdown.min())

    span = pd.Timestamp(value.index[-1]) - pd.Timestamp(value.index[0])
    days = span.days or 1
    cagr = ((final / initial_jpy) ** (365.0 / days) - 1.0) * 100.0

    return {
        "initialJpy": initial_jpy,
        "finalValue": final,
        "returnPct": return_pct,
        "maxDrawdownPct": max_drawdown,
        "cagrPct": cagr,
        "effectiveStart": points[0]["time"],
        "end": points[-1]["time"],
        "rebalances": rebalances,
        "points": points,
    }


def run_backtest(
    legs: list[dict[str, Any]],
    initial_jpy: float = 1_000_000.0,
    force: bool = False,
) -> dict[str, Any]:
    sig = "|".join(
        f"{leg['date']}:"
        + ",".join(
            f"{a['symbol']}={a['weight']}"
            for a in sorted(leg["allocations"], key=lambda x: x["symbol"])
        )
        for leg in sorted(legs, key=lambda leg: leg["date"])
    )
    key = f"{initial_jpy}#{sig}"
    payload, fetched_at = _backtest_store.get_or_compute(
        key, lambda: _compute(legs, initial_jpy), force=force
    )
    return {**payload, **_freshness(fetched_at)}
