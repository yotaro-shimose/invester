"""Valuation of an actual trade log (a portfolio), evaluated live in JPY.

Cash model — "auto funding": a buy is paid from existing cash; any shortfall is
treated as fresh invested capital at that moment. A sell adds its proceeds back
to cash, available for later buys. So the user only logs buys and sells; the
equity curve (cash + holdings value over time) and invested capital follow.

Each trade can be recorded by share count or by JPY amount; the missing one is
derived from that day's price. The fill price defaults to the trade date's
close and can be overridden per trade (native currency). Foreign instruments
are converted to JPY via the matching ``<CCY>JPY=X`` FX series.
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from .instruments import BY_SYMBOL
from .backtest import _fx_to_jpy, _jpy_price_matrix
from .market import _TTLStore, _freshness, get_currency

PORTFOLIO_TTL = 120.0
_portfolio_store = _TTLStore(PORTFOLIO_TTL)


def _label(symbol: str) -> str:
    inst = BY_SYMBOL.get(symbol)
    return inst.name_ja if inst else symbol


def _compute(trades: list[dict[str, Any]]) -> dict[str, Any]:
    valid = [t for t in trades if t.get("symbol") and t.get("date")]
    if not valid:
        raise ValueError("No valid trades.")

    trades_sorted = sorted(valid, key=lambda t: t["date"])
    symbols = sorted({t["symbol"].upper() for t in trades_sorted})
    start = trades_sorted[0]["date"]

    jpy = _jpy_price_matrix(symbols, start)
    dates = jpy.index
    n = len(dates)

    currencies = {s: get_currency(s) for s in symbols}
    need_fx = any(t.get("price") for t in trades_sorted)
    fx = _fx_to_jpy(set(currencies.values()), start) if need_fx else {}

    def price_jpy(symbol: str, pos: int, override: Any) -> float:
        if override in (None, "", 0):
            return float(jpy[symbol].iloc[pos])
        cur = currencies[symbol]
        if cur == "JPY":
            return float(override)
        rate = fx[cur].reindex(jpy.index).ffill().bfill()
        return float(override) * float(rate.iloc[pos])

    # Map each trade to a trading-day index.
    events: list[tuple[int, dict[str, Any]]] = []
    for t in trades_sorted:
        pos = int(dates.searchsorted(pd.Timestamp(t["date"]), side="left"))
        if pos >= n:
            pos = n - 1  # trade dated in the future of available data
        events.append((pos, t))
    events.sort(key=lambda e: e[0])

    holdings: dict[str, float] = {}
    avg_cost: dict[str, float] = {}
    cash = 0.0
    invested = 0.0
    realized = 0.0
    trade_details: list[dict[str, Any]] = []

    value = pd.Series(index=dates, dtype=float)

    for k, (pos, t) in enumerate(events):
        sym = t["symbol"].upper()
        side = t.get("side", "buy")
        pj = price_jpy(sym, pos, t.get("price"))

        if t.get("mode") == "amount":
            amount = float(t.get("amountJpy") or 0)
            shares = amount / pj if pj else 0.0
            cost = amount
        else:
            shares = float(t.get("shares") or 0)
            cost = shares * pj

        if side == "buy":
            if cash >= cost:
                cash -= cost
            else:
                invested += cost - cash
                cash = 0.0
            prev_sh = holdings.get(sym, 0.0)
            prev_cost = avg_cost.get(sym, 0.0) * prev_sh
            new_sh = prev_sh + shares
            avg_cost[sym] = (prev_cost + cost) / new_sh if new_sh else 0.0
            holdings[sym] = new_sh
        else:  # sell
            ac = avg_cost.get(sym, 0.0)
            realized += shares * (pj - ac)
            holdings[sym] = holdings.get(sym, 0.0) - shares
            cash += shares * pj

        trade_details.append(
            {
                "id": t.get("id"),
                "date": dates[pos].strftime("%Y-%m-%d"),
                "symbol": sym,
                "label": _label(sym),
                "side": side,
                "shares": shares,
                "priceJpy": pj,
                "costJpy": cost,
            }
        )

        end = events[k + 1][0] if k + 1 < len(events) else n
        if end > pos:
            segment = jpy.iloc[pos:end]
            seg_value = pd.Series(cash, index=segment.index)
            for s, sh in holdings.items():
                if sh:
                    seg_value = seg_value + sh * segment[s]
            value.iloc[pos:end] = seg_value

    value = value.dropna()
    if value.empty:
        raise ValueError("Portfolio produced no data points.")

    last_prices = {s: float(jpy[s].iloc[-1]) for s in symbols}
    positions = []
    unrealized = 0.0
    for sym in symbols:
        sh = holdings.get(sym, 0.0)
        if abs(sh) < 1e-9:
            continue
        ac = avg_cost.get(sym, 0.0)
        price = last_prices[sym]
        val = sh * price
        upnl = sh * (price - ac)
        unrealized += upnl
        positions.append(
            {
                "symbol": sym,
                "label": _label(sym),
                "shares": sh,
                "avgCostJpy": ac,
                "priceJpy": price,
                "valueJpy": val,
                "unrealizedPnl": upnl,
                "unrealizedPct": ((price / ac - 1) * 100) if ac else 0.0,
            }
        )
    positions.sort(key=lambda p: p["valueJpy"], reverse=True)

    current_value = float(value.iloc[-1])
    total_pnl = current_value - invested
    total_return = (current_value / invested - 1) * 100 if invested else 0.0

    running_max = value.cummax()
    drawdown = (value / running_max - 1.0) * 100.0
    max_drawdown = float(drawdown.min())

    span = pd.Timestamp(value.index[-1]) - pd.Timestamp(value.index[0])
    days = span.days or 1
    cagr = (
        ((current_value / invested) ** (365.0 / days) - 1.0) * 100.0
        if invested > 0
        else 0.0
    )

    points = [
        {"time": pd.Timestamp(ts).strftime("%Y-%m-%d"), "value": float(v)}
        for ts, v in value.items()
    ]

    return {
        "start": points[0]["time"],
        "end": points[-1]["time"],
        "investedCapital": invested,
        "currentValue": current_value,
        "cashJpy": cash,
        "holdingsValue": current_value - cash,
        "totalPnl": total_pnl,
        "totalReturnPct": total_return,
        "cagrPct": cagr,
        "realizedPnl": realized,
        "unrealizedPnl": unrealized,
        "maxDrawdownPct": max_drawdown,
        "positions": positions,
        "tradeDetails": trade_details,
        "points": points,
    }


def run_portfolio(trades: list[dict[str, Any]], force: bool = False) -> dict[str, Any]:
    sig = "|".join(
        f"{t.get('date')}:{t.get('symbol')}:{t.get('side')}:{t.get('mode')}:"
        f"{t.get('shares')}:{t.get('amountJpy')}:{t.get('price')}"
        for t in sorted(trades, key=lambda t: t.get("date", ""))
    )
    payload, fetched_at = _portfolio_store.get_or_compute(
        sig or "empty", lambda: _compute(trades), force=force
    )
    return {**payload, **_freshness(fetched_at)}
