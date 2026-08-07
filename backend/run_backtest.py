from __future__ import annotations

from .data.sources.yfinance_source import load_ohlcv
from .engine.backtest import run_backtest
from .engine.strategies.ma_crossover import MovingAverageCrossoverStrategy


def main() -> None:
    symbol = "AAPL"
    data = load_ohlcv(symbol, start="2020-01-01", end="2024-01-01")
    strategy = MovingAverageCrossoverStrategy(fast_period=10, slow_period=30)

    result = run_backtest(data, strategy)
    m = result.metrics

    print(f"\n{symbol}: {len(data)} bars, {m.total_trades} trades\n")
    print(f"Win rate:       {m.win_rate:.1%}")
    print(f"Expectancy:     {m.expectancy:+.2f}R")
    print(f"Profit factor:  {m.profit_factor:.2f}")
    print(f"Max drawdown:   {m.max_drawdown_pct:.1%}")
    print(f"Final equity:   ${result.equity_curve[-1]:,.2f}")

    print("\nLast 5 trades:")
    for trade in result.trades[-5:]:
        print(
            f"  {trade.direction.value:5s} entry={trade.entry_price:7.2f} "
            f"exit={trade.exit_price:7.2f} R={trade.r_multiple:+.2f} "
            f"pnl=${trade.pnl:+.2f}"
        )


if __name__ == "__main__":
    main()
