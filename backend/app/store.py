"""JSON-file persistence for the watchlist and backtest strategies.

This is the single source of truth shared by the frontend UI and any other
caller (e.g. ad-hoc edits via the HTTP API). It is intentionally a small,
human-readable JSON file rather than a database.

Strategy model — a strategy is a *timeline of rebalances* ("legs"). Each leg
has a date and a target allocation; the portfolio is rebuilt to that
allocation (selling to JPY and re-buying) on that date. A plain buy-and-hold
strategy is simply a single leg.
"""

from __future__ import annotations

import json
import threading
import time
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
STORE_PATH = DATA_DIR / "store.json"

_lock = threading.RLock()
_id_counter = 0

PALETTE = [
    "#34d399", "#60a5fa", "#f472b6", "#fbbf24",
    "#a78bfa", "#f87171", "#22d3ee", "#a3e635",
]


def _default() -> dict[str, Any]:
    return {"tickers": [], "strategies": []}


def _read() -> dict[str, Any]:
    if not STORE_PATH.exists():
        return _default()
    try:
        data = json.loads(STORE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return _default()
    data.setdefault("tickers", [])
    data.setdefault("strategies", [])
    data["strategies"] = [_normalize_strategy(s) for s in data["strategies"]]
    return data


def _write(data: dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STORE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(STORE_PATH)


def _normalize_strategy(s: dict[str, Any]) -> dict[str, Any]:
    """Migrate older {start, allocations} strategies to the legs model."""
    s = dict(s)
    if "legs" not in s:
        s["legs"] = [
            {
                "date": s.get("start", ""),
                "allocations": s.get("allocations", []),
            }
        ]
    s.pop("start", None)
    s.pop("allocations", None)
    s.setdefault("notes", "")
    s.setdefault("initialJpy", 1_000_000)
    return s


def _new_id() -> str:
    global _id_counter
    _id_counter += 1
    return f"s_{time.time_ns()}_{_id_counter}"


# ----- watchlist tickers -------------------------------------------------

def get_tickers() -> list[dict[str, Any]]:
    with _lock:
        return _read()["tickers"]


def add_ticker(symbol: str, label: str | None = None) -> dict[str, Any]:
    symbol = symbol.strip().upper()
    label = (label or symbol).strip()
    with _lock:
        data = _read()
        for t in data["tickers"]:
            if t["symbol"] == symbol:
                t["label"] = label  # update label if re-added
                _write(data)
                return t
        ticker = {"symbol": symbol, "label": label}
        data["tickers"].append(ticker)
        _write(data)
        return ticker


def remove_ticker(symbol: str) -> bool:
    symbol = symbol.strip().upper()
    with _lock:
        data = _read()
        before = len(data["tickers"])
        data["tickers"] = [t for t in data["tickers"] if t["symbol"] != symbol]
        _write(data)
        return len(data["tickers"]) < before


# ----- strategies --------------------------------------------------------

def get_strategies() -> list[dict[str, Any]]:
    with _lock:
        return _read()["strategies"]


def get_strategy(strategy_id: str) -> dict[str, Any] | None:
    with _lock:
        for s in _read()["strategies"]:
            if s["id"] == strategy_id:
                return s
    return None


def create_strategy(payload: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        data = _read()
        strategy = {
            "id": _new_id(),
            "name": payload.get("name", "戦略"),
            "color": payload.get("color")
            or PALETTE[len(data["strategies"]) % len(PALETTE)],
            "notes": payload.get("notes", ""),
            "initialJpy": payload.get("initialJpy", 1_000_000),
            "legs": payload.get("legs", []),
        }
        data["strategies"].append(strategy)
        _write(data)
        return strategy


def update_strategy(strategy_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
    with _lock:
        data = _read()
        for i, s in enumerate(data["strategies"]):
            if s["id"] == strategy_id:
                for key in ("name", "color", "notes", "initialJpy", "legs"):
                    if key in patch and patch[key] is not None:
                        s[key] = patch[key]
                data["strategies"][i] = s
                _write(data)
                return s
    return None


def delete_strategy(strategy_id: str) -> bool:
    with _lock:
        data = _read()
        before = len(data["strategies"])
        data["strategies"] = [s for s in data["strategies"] if s["id"] != strategy_id]
        _write(data)
        return len(data["strategies"]) < before
