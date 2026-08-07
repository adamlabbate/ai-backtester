from __future__ import annotations

from typing import TYPE_CHECKING

from ..strategy import Direction, Signal

if TYPE_CHECKING:
    from ..state import BacktestState


class MovingAverageCrossoverStrategy:
    """Goes long when the fast simple moving average crosses above the slow
    one. The one hardcoded strategy for Phase 1 -- its only job is proving
    the engine works correctly end-to-end before anything AI-driven sits on
    top of it.

    Stop is a fixed percentage below entry; target is a multiple of the
    resulting risk (a 2.0 target_r means the target is 2x as far from entry
    as the stop is).
    """

    def __init__(
        self,
        fast_period: int = 10,
        slow_period: int = 30,
        stop_pct: float = 0.02,
        target_r: float = 2.0,
    ) -> None:
        self.fast_period = fast_period
        self.slow_period = slow_period
        self.stop_pct = stop_pct
        self.target_r = target_r

    def on_bar(self, state: "BacktestState") -> Signal | None:
        closes = state.bars["Close"]
        if len(closes) < self.slow_period + 1:
            return None  # not enough history yet to compute the slow MA

        fast_ma = closes.rolling(self.fast_period).mean()
        slow_ma = closes.rolling(self.slow_period).mean()

        crossed_up = fast_ma.iloc[-2] <= slow_ma.iloc[-2] and fast_ma.iloc[-1] > slow_ma.iloc[-1]
        if not crossed_up:
            return None

        entry = state.close
        stop = entry * (1 - self.stop_pct)
        target = entry + (entry - stop) * self.target_r
        return Signal(
            direction=Direction.LONG,
            stop=stop,
            target=target,
            reason="fast MA crossed above slow MA",
        )
