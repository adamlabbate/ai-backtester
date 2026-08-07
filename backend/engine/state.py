from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from .trade_manager import Position


@dataclass
class BacktestState:
    """The view of the world handed to a strategy's on_bar() every bar.

    `full_data` holds the entire OHLCV history for the run, but it's not
    meant to be touched directly -- every accessor below slices it down to
    `current_index`. As long as a strategy only reads through `bars`,
    `current_bar`, `close`, etc. (never `full_data` itself), lookahead bias
    is structurally impossible, not just discouraged by convention.
    """

    full_data: pd.DataFrame
    current_index: int
    equity: float
    position: Position | None = None

    @property
    def bars(self) -> pd.DataFrame:
        """All bars from the start of history through 'now', inclusive."""
        return self.full_data.iloc[: self.current_index + 1]

    @property
    def current_bar(self) -> pd.Series:
        return self.full_data.iloc[self.current_index]

    @property
    def close(self) -> float:
        return float(self.current_bar["Close"])

    @property
    def high(self) -> float:
        return float(self.current_bar["High"])

    @property
    def low(self) -> float:
        return float(self.current_bar["Low"])

    @property
    def in_position(self) -> bool:
        return self.position is not None
