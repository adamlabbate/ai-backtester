from __future__ import annotations

import math

from fastapi import APIRouter

from ...data.sources.yfinance_source import load_ohlcv
from ...engine.backtest import run_backtest
from ...engine.strategies.ma_crossover import MovingAverageCrossoverStrategy
from ..schemas import BacktestRequest, BacktestResponse, BarOut, EquityPoint, MetricsOut, TradeOut

# APIRouter groups related endpoints so main.py doesn't have to define every
# route directly -- this file's routes get mounted onto the app under a
# prefix (see api/main.py). It's how FastAPI apps stay organized as they
# grow past a handful of endpoints.
router = APIRouter()


@router.post("/backtest", response_model=BacktestResponse)
def run_backtest_endpoint(request: BacktestRequest) -> BacktestResponse:
    """Run the Phase 1 engine against real data and return everything the
    frontend needs to render it: the OHLCV bars themselves (for the chart),
    the trade list, the equity curve, and summary metrics.

    `response_model=BacktestResponse` tells FastAPI to validate whatever
    this function returns against that schema and serialize it to JSON --
    if a field were missing or the wrong type, this would fail loudly here
    rather than silently shipping bad data to the frontend.
    """
    data = load_ohlcv(request.symbol, start=request.start, end=request.end)

    strategy = MovingAverageCrossoverStrategy(
        fast_period=request.fast_period,
        slow_period=request.slow_period,
        stop_pct=request.stop_pct,
        target_r=request.target_r,
    )
    result = run_backtest(data, strategy, initial_equity=request.initial_equity)

    dates = data.index.strftime("%Y-%m-%d")

    bars = [
        BarOut(
            time=dates[i],
            open=float(data["Open"].iloc[i]),
            high=float(data["High"].iloc[i]),
            low=float(data["Low"].iloc[i]),
            close=float(data["Close"].iloc[i]),
            volume=float(data["Volume"].iloc[i]),
        )
        for i in range(len(data))
    ]

    trades = [
        TradeOut(
            direction=trade.direction.value,
            entry_price=trade.entry_price,
            exit_price=trade.exit_price,
            stop=trade.stop,
            target=trade.target,
            entry_time=dates[trade.entry_index],
            exit_time=dates[trade.exit_index],
            r_multiple=trade.r_multiple,
            pnl=trade.pnl,
            reason=trade.reason,
        )
        for trade in result.trades
    ]

    # equity_curve[0] is the starting equity before any bar; equity_curve[i+1]
    # is equity after bar i closes, so it lines up 1:1 with `dates`.
    equity_curve = [EquityPoint(time=dates[i], equity=result.equity_curve[i + 1]) for i in range(len(data))]

    profit_factor = result.metrics.profit_factor
    metrics = MetricsOut(
        total_trades=result.metrics.total_trades,
        win_rate=result.metrics.win_rate,
        expectancy=result.metrics.expectancy,
        profit_factor=None if math.isinf(profit_factor) else profit_factor,
        max_drawdown_pct=result.metrics.max_drawdown_pct,
    )

    return BacktestResponse(
        symbol=request.symbol,
        bars=bars,
        trades=trades,
        equity_curve=equity_curve,
        metrics=metrics,
    )
