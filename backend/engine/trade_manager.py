from __future__ import annotations

from dataclasses import dataclass

from .strategy import Direction, Signal


@dataclass
class Position:
    """A trade that's currently open, tracked bar-by-bar until it's stopped
    out or hits target."""

    direction: Direction
    entry_price: float
    stop: float
    target: float
    entry_index: int
    risk_amount: float
    reason: str = ""

    @property
    def risk_per_unit(self) -> float:
        """Distance from entry to stop -- the '1R' unit for this trade."""
        return abs(self.entry_price - self.stop)


@dataclass
class ClosedTrade:
    """A completed trade. `r_multiple` is the outcome expressed relative to
    what was risked: +2.0 means it made twice what was put at risk, -1.0
    means the stop was hit for a full loss."""

    direction: Direction
    entry_price: float
    exit_price: float
    stop: float
    target: float
    entry_index: int
    exit_index: int
    r_multiple: float
    pnl: float
    reason: str = ""


class TradeManager:
    """Owns entry/exit logic, equity, and the running list of closed trades.

    Only one position open at a time -- keeps Phase 1 simple. Position
    sizing is a fixed percentage of equity risked per trade.
    """

    def __init__(self, initial_equity: float, risk_per_trade_pct: float = 0.01) -> None:
        self.equity = initial_equity
        self.risk_per_trade_pct = risk_per_trade_pct
        self.position: Position | None = None
        self.closed_trades: list[ClosedTrade] = []
        self.equity_curve: list[float] = [initial_equity]

    def open_position(self, signal: Signal, entry_price: float, bar_index: int) -> Position:
        risk_amount = self.equity * self.risk_per_trade_pct
        position = Position(
            direction=signal.direction,
            entry_price=entry_price,
            stop=signal.stop,
            target=signal.target,
            entry_index=bar_index,
            risk_amount=risk_amount,
            reason=signal.reason,
        )
        self.position = position
        return position

    def check_exit(self, bar_index: int, high: float, low: float) -> ClosedTrade | None:
        """Check whether this bar's range hit the stop or target.

        If both were touched in the same bar, the stop wins -- we can't tell
        from OHLC data alone which happened first intrabar, so this is the
        conservative assumption.
        """
        if self.position is None:
            return None

        position = self.position
        exit_price = self._resolve_exit_price(position, high, low)
        if exit_price is None:
            return None

        r_multiple = self._r_multiple(position, exit_price)
        pnl = r_multiple * position.risk_amount
        trade = ClosedTrade(
            direction=position.direction,
            entry_price=position.entry_price,
            exit_price=exit_price,
            stop=position.stop,
            target=position.target,
            entry_index=position.entry_index,
            exit_index=bar_index,
            r_multiple=r_multiple,
            pnl=pnl,
            reason=position.reason,
        )
        self.closed_trades.append(trade)
        self.equity += pnl
        self.position = None
        return trade

    def record_equity(self) -> None:
        """Call once per bar so the equity curve has one point per bar, not
        just one point per closed trade."""
        self.equity_curve.append(self.equity)

    @staticmethod
    def _resolve_exit_price(position: Position, high: float, low: float) -> float | None:
        if position.direction is Direction.LONG:
            if low <= position.stop:
                return position.stop
            if high >= position.target:
                return position.target
        else:
            if high >= position.stop:
                return position.stop
            if low <= position.target:
                return position.target
        return None

    @staticmethod
    def _r_multiple(position: Position, exit_price: float) -> float:
        risk = position.risk_per_unit
        if risk == 0:
            return 0.0
        if position.direction is Direction.LONG:
            return (exit_price - position.entry_price) / risk
        return (position.entry_price - exit_price) / risk
