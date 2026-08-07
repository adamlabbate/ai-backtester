from __future__ import annotations

from dataclasses import dataclass

from .trade_manager import ClosedTrade


@dataclass
class Metrics:
    total_trades: int
    win_rate: float
    expectancy: float  # average R-multiple per trade
    profit_factor: float
    max_drawdown_pct: float


def compute_metrics(trades: list[ClosedTrade], equity_curve: list[float]) -> Metrics:
    if not trades:
        return Metrics(total_trades=0, win_rate=0.0, expectancy=0.0, profit_factor=0.0, max_drawdown_pct=0.0)

    wins = [t for t in trades if t.r_multiple > 0]
    losses = [t for t in trades if t.r_multiple <= 0]

    win_rate = len(wins) / len(trades)
    expectancy = sum(t.r_multiple for t in trades) / len(trades)

    gross_profit = sum(t.pnl for t in wins)
    gross_loss = abs(sum(t.pnl for t in losses))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")

    return Metrics(
        total_trades=len(trades),
        win_rate=win_rate,
        expectancy=expectancy,
        profit_factor=profit_factor,
        max_drawdown_pct=_max_drawdown_pct(equity_curve),
    )


def _max_drawdown_pct(equity_curve: list[float]) -> float:
    """Largest peak-to-trough decline in the equity curve, as a fraction
    (0.15 means a 15% drawdown from some earlier peak)."""
    peak = equity_curve[0]
    max_dd = 0.0
    for value in equity_curve:
        peak = max(peak, value)
        drawdown = (peak - value) / peak if peak > 0 else 0.0
        max_dd = max(max_dd, drawdown)
    return max_dd
