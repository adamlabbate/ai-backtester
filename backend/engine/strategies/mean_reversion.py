from __future__ import annotations

from typing import TYPE_CHECKING

from ..strategy import Direction, Signal

if TYPE_CHECKING:
    from ..state import BacktestState


class MeanReversionStrategy:
    """Goes long when price closes more than `num_std` standard deviations
    below its rolling mean (a Bollinger-Band-style lower deviation) --
    betting that an unusually large move down snaps back toward average,
    rather than continuing.

    This is the opposite premise from BreakoutStrategy: breakout bets a new
    extreme keeps going, mean reversion bets it doesn't. Same risk model as
    the other templates otherwise: fixed percentage stop, target as a
    multiple of that risk.
    """

    def __init__(
        self,
        period: int = 20,
        num_std: float = 2.0,
        stop_pct: float = 0.02,
        target_r: float = 2.0,
    ) -> None:
        self.period = period
        self.num_std = num_std
        self.stop_pct = stop_pct
        self.target_r = target_r

    def on_bar(self, state: "BacktestState") -> Signal | None:
        closes = state.bars["Close"]
        if len(closes) < self.period + 1:
            return None  # not enough history yet to compute the rolling mean/std

        window = closes.iloc[-self.period :]
        mean = window.mean()
        std = window.std()
        lower_band = mean - self.num_std * std

        if state.close >= lower_band:
            return None

        entry = state.close
        stop = entry * (1 - self.stop_pct)
        target = entry + (entry - stop) * self.target_r
        return Signal(
            direction=Direction.LONG,
            stop=stop,
            target=target,
            reason=f"closed {self.num_std:.1f} std below {self.period}-bar mean ({mean:.2f})",
        )
