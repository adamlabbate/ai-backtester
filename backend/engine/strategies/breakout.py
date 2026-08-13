from __future__ import annotations

from typing import TYPE_CHECKING

from ..strategy import Direction, Signal

if TYPE_CHECKING:
    from ..state import BacktestState


class BreakoutStrategy:
    """Goes long when price closes above the highest high of the prior N
    bars (a Donchian-channel-style breakout) -- betting that a new high
    means the move continues, not reverses.

    Same risk model as the other Phase 1/3 templates: fixed percentage
    stop, target expressed as a multiple of that risk.
    """

    def __init__(self, lookback_period: int = 20, stop_pct: float = 0.02, target_r: float = 2.0) -> None:
        self.lookback_period = lookback_period
        self.stop_pct = stop_pct
        self.target_r = target_r

    def on_bar(self, state: "BacktestState") -> Signal | None:
        highs = state.bars["High"]
        if len(highs) < self.lookback_period + 1:
            return None  # not enough history yet to establish a breakout level

        # The breakout level is the highest high of the N bars *before* this
        # one -- excluding the current bar keeps today's own high from
        # inflating the level it's being compared against.
        prior_highs = highs.iloc[-(self.lookback_period + 1) : -1]
        breakout_level = prior_highs.max()

        if state.close <= breakout_level:
            return None

        entry = state.close
        stop = entry * (1 - self.stop_pct)
        target = entry + (entry - stop) * self.target_r
        return Signal(
            direction=Direction.LONG,
            stop=stop,
            target=target,
            reason=f"closed above {self.lookback_period}-bar high ({breakout_level:.2f})",
        )
