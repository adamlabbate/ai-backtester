from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from .metrics import Metrics, compute_metrics
from .state import BacktestState
from .strategy import Strategy
from .trade_manager import ClosedTrade, TradeManager


@dataclass
class BacktestResult:
    trades: list[ClosedTrade]
    equity_curve: list[float]
    metrics: Metrics


def run_backtest(data: pd.DataFrame, strategy: Strategy, initial_equity: float = 10_000.0) -> BacktestResult:
    """Iterate the data bar-by-bar: check whether the current bar closes out
    an open trade, build the BacktestState for 'now', let the strategy react
    if flat, then advance.

    This function is the only place that ever sees the full dataset;
    everything downstream (the strategy, via BacktestState) only sees what
    it's explicitly allowed to.
    """
    trade_manager = TradeManager(initial_equity=initial_equity)

    for index in range(len(data)):
        bar = data.iloc[index]

        trade_manager.check_exit(bar_index=index, high=float(bar["High"]), low=float(bar["Low"]))

        state = BacktestState(
            full_data=data,
            current_index=index,
            equity=trade_manager.equity,
            position=trade_manager.position,
        )

        if trade_manager.position is None:
            signal = strategy.on_bar(state)
            if signal is not None:
                trade_manager.open_position(signal, entry_price=state.close, bar_index=index)

        trade_manager.record_equity()

    metrics = compute_metrics(trade_manager.closed_trades, trade_manager.equity_curve)
    return BacktestResult(
        trades=trade_manager.closed_trades,
        equity_curve=trade_manager.equity_curve,
        metrics=metrics,
    )
