"""FastAPI app: market data, a JPY backtester, and persisted watchlist/strategies.

The watchlist and strategies live in a backend JSON store and are edited
exclusively through these endpoints — the frontend UI and any ad-hoc caller
(e.g. curl) go through the same CRUD API, so they always stay in sync.
"""

from typing import Any

from pydantic import BaseModel, Field

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import store
from .backtest import run_backtest
from .instruments import BY_SLUG
from .market import (
    RANGE_CONFIG,
    custom_instrument,
    get_history,
    get_overview,
    get_quotes,
)

app = FastAPI(title="Invester API", version="0.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


def _validate_range(range_value: str) -> str:
    range_key = range_value.upper()
    if range_key not in RANGE_CONFIG:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid range. Choose one of: {', '.join(RANGE_CONFIG)}",
        )
    return range_key


def _ticker_has_data(symbol: str) -> bool:
    res = get_quotes([symbol], "5D", force=True)
    return any(i["price"] is not None for i in res["instruments"])


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ----- market data -------------------------------------------------------

@app.get("/api/sectors")
def sectors_overview(range: str = "1M", refresh: bool = False) -> dict:
    return get_overview("sector", _validate_range(range), force=refresh)


@app.get("/api/indices")
def indices_overview(range: str = "1M", refresh: bool = False) -> dict:
    return get_overview("index", _validate_range(range), force=refresh)


@app.get("/api/quotes")
def quotes(
    symbols: list[str] = Query(default=[]),
    range: str = "1M",
    refresh: bool = False,
) -> dict:
    cleaned = [s.strip().upper() for s in symbols if s.strip()]
    return get_quotes(cleaned, _validate_range(range), force=refresh)


@app.get("/api/markets/{slug}/history")
def market_history(slug: str, range: str = "1Y", refresh: bool = False) -> dict:
    inst = BY_SLUG.get(slug) or custom_instrument(slug.upper())
    result = get_history(inst, _validate_range(range), force=refresh)
    if not result["candles"]:
        raise HTTPException(status_code=404, detail=f"No data for instrument: {slug}")
    return result


# ----- watchlist (persisted) --------------------------------------------

class TickerIn(BaseModel):
    symbol: str
    label: str | None = None


@app.get("/api/watchlist")
def list_watchlist() -> list[dict]:
    return store.get_tickers()


@app.post("/api/watchlist", status_code=201)
def add_watchlist(ticker: TickerIn) -> dict:
    symbol = ticker.symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="symbol is required")
    if symbol in BY_SLUG:
        raise HTTPException(status_code=400, detail="Symbol is already a built-in instrument")
    if not _ticker_has_data(symbol):
        raise HTTPException(status_code=400, detail=f"No price data for ticker: {symbol}")
    return store.add_ticker(symbol, ticker.label)


@app.delete("/api/watchlist/{symbol}")
def delete_watchlist(symbol: str) -> dict:
    if not store.remove_ticker(symbol):
        raise HTTPException(status_code=404, detail=f"Ticker not in watchlist: {symbol}")
    return {"ok": True}


# ----- strategies (persisted) -------------------------------------------

class Allocation(BaseModel):
    symbol: str
    label: str | None = None
    weight: float = Field(ge=0, le=100)


class Leg(BaseModel):
    date: str  # "YYYY-MM-DD"
    allocations: list[Allocation] = Field(default_factory=list)


class StrategyIn(BaseModel):
    name: str = "戦略"
    color: str | None = None
    notes: str = ""  # markdown
    initialJpy: float = Field(default=1_000_000.0, gt=0)
    legs: list[Leg] = Field(default_factory=list)


class StrategyPatch(BaseModel):
    name: str | None = None
    color: str | None = None
    notes: str | None = None
    initialJpy: float | None = Field(default=None, gt=0)
    legs: list[Leg] | None = None


def _validate_legs(legs: list[Leg]) -> list[dict[str, Any]]:
    if not legs:
        raise HTTPException(status_code=400, detail="At least one leg is required")
    out: list[dict[str, Any]] = []
    for leg in legs:
        total = sum(a.weight for a in leg.allocations)
        if total > 100.0001:
            raise HTTPException(
                status_code=400,
                detail=f"Leg {leg.date} allocations exceed 100% ({total:.1f}%)",
            )
        out.append(
            {
                "date": leg.date,
                "allocations": [
                    {
                        "symbol": a.symbol.strip().upper(),
                        "label": (a.label or a.symbol).strip(),
                        "weight": a.weight,
                    }
                    for a in leg.allocations
                    if a.symbol.strip()
                ],
            }
        )
    return out


@app.get("/api/strategies")
def list_strategies() -> list[dict]:
    return store.get_strategies()


@app.post("/api/strategies", status_code=201)
def create_strategy(payload: StrategyIn) -> dict:
    legs = _validate_legs(payload.legs)
    return store.create_strategy(
        {
            "name": payload.name,
            "color": payload.color,
            "notes": payload.notes,
            "initialJpy": payload.initialJpy,
            "legs": legs,
        }
    )


@app.put("/api/strategies/{strategy_id}")
def edit_strategy(strategy_id: str, patch: StrategyPatch) -> dict:
    update: dict[str, Any] = patch.model_dump(exclude_none=True)
    if patch.legs is not None:
        update["legs"] = _validate_legs(patch.legs)
    result = store.update_strategy(strategy_id, update)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Strategy not found: {strategy_id}")
    return result


@app.delete("/api/strategies/{strategy_id}")
def remove_strategy(strategy_id: str) -> dict:
    if not store.delete_strategy(strategy_id):
        raise HTTPException(status_code=404, detail=f"Strategy not found: {strategy_id}")
    return {"ok": True}


# ----- backtest ----------------------------------------------------------

class BacktestRequest(BaseModel):
    legs: list[Leg] = Field(default_factory=list)
    initialJpy: float = Field(default=1_000_000.0, gt=0)
    refresh: bool = False


@app.post("/api/backtest")
def backtest(req: BacktestRequest) -> dict:
    """Backtest an inline strategy (used for builder previews and saved runs)."""
    legs = _validate_legs(req.legs)
    if not any(leg["allocations"] for leg in legs):
        raise HTTPException(status_code=400, detail="No allocations provided.")
    try:
        return run_backtest(legs, req.initialJpy, force=req.refresh)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/strategies/{strategy_id}/backtest")
def backtest_saved(strategy_id: str, refresh: bool = False) -> dict:
    """Backtest a persisted strategy by id."""
    strategy = store.get_strategy(strategy_id)
    if strategy is None:
        raise HTTPException(status_code=404, detail=f"Strategy not found: {strategy_id}")
    try:
        return run_backtest(strategy["legs"], strategy["initialJpy"], force=refresh)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
