from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class BacktestRequest(BaseModel):
    """The JSON body a client sends to POST /api/backtest.

    Pydantic validates this automatically -- if the client sends
    strategy_params.fast_period as a string that can't parse to an int,
    FastAPI returns a 422 error with details before our code ever runs.
    Defaults here mean a client can POST an empty body ({}) and still get
    the Phase 1 demo run (MA crossover with its own built-in defaults).

    strategy_params is intentionally an open dict rather than a fixed set of
    fields: which parameters are valid depends on strategy_template (see
    ai/templates.py), and Phase 3 is exactly about letting Claude choose the
    template *and* the params from a plain-English description, so this
    endpoint can't know the shape in advance.
    """

    symbol: str = "AAPL"
    start: str = "2020-01-01"
    end: str = "2024-01-01"
    interval: str = "1d"  # yfinance interval string: "1d", "1h", "1wk", etc.
    initial_equity: float = 10_000.0
    strategy_template: str = "ma_crossover"
    strategy_params: dict[str, Any] = Field(default_factory=dict)


class InterpretRequest(BaseModel):
    description: str


class InterpretResponse(BaseModel):
    template: str
    label: str
    params: dict[str, Any]
    reasoning: str


class TemplateParamInfo(BaseModel):
    name: str
    type: str  # JSON schema type: "integer" or "number"
    description: str
    default: float | int | None


class TemplateInfo(BaseModel):
    id: str
    label: str
    description: str
    params: list[TemplateParamInfo]


class BarOut(BaseModel):
    """One OHLCV bar. `time` is a Unix timestamp (seconds) rather than a
    date string -- lightweight-charts needs real timestamps to place
    intraday bars correctly; a "YYYY-MM-DD" string only has day resolution,
    which would collide every bar on an hourly chart."""

    time: int
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
    entry_time: int
    exit_time: int
    r_multiple: float
    pnl: float
    reason: str


class EquityPoint(BaseModel):
    time: int
    equity: float


class MetricsOut(BaseModel):
    total_trades: int
    win_rate: float
    expectancy: float
    profit_factor: float | None  # None means no losing trades (undefined, not infinite)
    max_drawdown_pct: float


class BacktestResponse(BaseModel):
    symbol: str
    strategy_template: str
    strategy_params: dict[str, Any]
    bars: list[BarOut]
    trades: list[TradeOut]
    equity_curve: list[EquityPoint]
    metrics: MetricsOut


class GenerateStrategyRequest(BaseModel):
    """The JSON body for POST /api/generate-strategy -- same
    symbol/date/interval shape as a normal backtest, plus the plain-English
    description Claude writes code from. There's no strategy_template here:
    Phase 4 doesn't pick from a fixed set, it writes something new."""

    description: str
    symbol: str = "AAPL"
    start: str = "2020-01-01"
    end: str = "2024-01-01"
    interval: str = "1d"
    initial_equity: float = 10_000.0


class GenerateStrategyResponse(BaseModel):
    symbol: str
    code: str
    attempts: int
    bars: list[BarOut]
    trades: list[TradeOut]
    equity_curve: list[EquityPoint]
    metrics: MetricsOut
