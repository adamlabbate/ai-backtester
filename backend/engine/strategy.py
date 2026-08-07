from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from .state import BacktestState


class Direction(Enum):
    LONG = "long"
    SHORT = "short"


@dataclass(frozen=True)
class Signal:
    """Emitted by a strategy when it wants to open a trade.

    There's no entry price here on purpose: the engine fills at the close of
    the bar the signal fired on (see run_backtest in backtest.py). That's a
    Phase 1 simplification -- real fills would happen on the next bar's open
    -- worth revisiting once the engine has more than one strategy to prove
    itself against.
    """

    direction: Direction
    stop: float
    target: float
    reason: str = ""


class Strategy(Protocol):
    def on_bar(self, state: "BacktestState") -> Signal | None:
        """Called once per bar, in chronological order, only when no
        position is currently open (Phase 1 supports one trade at a time).
        Return a Signal to enter a trade, or None to do nothing this bar.
        """
        ...
