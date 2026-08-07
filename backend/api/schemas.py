from __future__ import annotations

from pydantic import BaseModel


class BacktestRequest(BaseModel):
    """The JSON body a client sends to POST /api/backtest.

    Pydantic validates this automatically -- if the client sends
    fast_period as a string that can't parse to an int, FastAPI returns a
    422 error with details before our code ever runs. Defaults here mean a
    client can POST an empty body ({}) and still get the Phase 1 demo run.
    """

    symbol: str = "AAPL"
    start: str = "2020-01-01"
    end: str = "2024-01-01"
    fast_period: int = 10
    slow_period: int = 30
    stop_pct: float = 0.02
    target_r: float = 2.0
    initial_equity: float = 10_000.0


class BarOut(BaseModel):
    """One OHLCV bar, shaped for lightweight-charts (which expects
    {time, open, high, low, close} for candlesticks)."""

    time: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class TradeOut(BaseModel):
    direction: str
    entry_price: float
    exit_price: float
    stop: float
    target: float
    entry_time: str
    exit_time: str
    r_multiple: float
    pnl: float
    reason: str


class EquityPoint(BaseModel):
    time: str
    equity: float


class MetricsOut(BaseModel):
    total_trades: int
    win_rate: float
    expectancy: float
    profit_factor: float | None  # None means no losing trades (undefined, not infinite)
    max_drawdown_pct: float


class BacktestResponse(BaseModel):
    symbol: str
    bars: list[BarOut]
    trades: list[TradeOut]
    equity_curve: list[EquityPoint]
    metrics: MetricsOut
