"""Entrypoint for the sandbox Docker image (see Dockerfile in this
directory). Everything in this file runs *inside* the untrusted container --
network-isolated, resource-limited, non-root, read-only filesystem. It reads
a strategy + OHLCV data from stdin, executes the strategy against the real
engine, and writes the result (or an error) to stdout as one line of JSON.

This deliberately doesn't import anything from backend/api/ -- that layer
isn't copied into the image, and pulling it in would mean shipping pydantic
and the rest of the API stack into a box whose only job is running one
untrusted function. The small amount of response-shaping duplicated from
routes/backtest.py is the cost of keeping the trust boundary a real
directory boundary, not just a convention.
"""

from __future__ import annotations

import json
import math
import sys
import traceback

import pandas as pd

from engine.backtest import run_backtest
from engine.strategy import Direction, Signal

# The namespace the generated code executes in. No `__import__`, no file
# I/O, no introspection builtins -- just enough to write ordinary
# arithmetic/comparisons and construct a Signal. This is defense-in-depth
# alongside the AST check that already ran on the host before this
# container was even started; if something slipped past that check, it
# still lands in a namespace with no dangerous names to call.
SAFE_BUILTINS = {
    "abs": abs,
    "min": min,
    "max": max,
    "sum": sum,
    "len": len,
    "range": range,
    "enumerate": enumerate,
    "zip": zip,
    "round": round,
    "float": float,
    "int": int,
    "bool": bool,
    "str": str,
    "list": list,
    "dict": dict,
    "tuple": tuple,
    "set": set,
    "sorted": sorted,
    "reversed": reversed,
    "all": all,
    "any": any,
    "True": True,
    "False": False,
    "None": None,
}


class GeneratedStrategy:
    """Adapts a bare `on_bar` function (what Claude generates) to the
    Strategy protocol (which expects a method) -- see engine/strategy.py."""

    def __init__(self, on_bar_fn):
        self._on_bar_fn = on_bar_fn

    def on_bar(self, state):
        return self._on_bar_fn(state)


def build_dataframe(bars: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(bars)
    df.index = pd.to_datetime(df.pop("time"), unit="s")
    return df


def serialize_result(result, times: list[int]) -> dict:
    trades = [
        {
            "direction": trade.direction.value,
            "entry_price": trade.entry_price,
            "exit_price": trade.exit_price,
            "stop": trade.stop,
            "target": trade.target,
            "entry_time": times[trade.entry_index],
            "exit_time": times[trade.exit_index],
            "r_multiple": trade.r_multiple,
            "pnl": trade.pnl,
            "reason": trade.reason,
        }
        for trade in result.trades
    ]
    equity_curve = [
        {"time": times[i], "equity": result.equity_curve[i + 1]} for i in range(len(times))
    ]
    profit_factor = result.metrics.profit_factor
    metrics = {
        "total_trades": result.metrics.total_trades,
        "win_rate": result.metrics.win_rate,
        "expectancy": result.metrics.expectancy,
        "profit_factor": None if math.isinf(profit_factor) else profit_factor,
        "max_drawdown_pct": result.metrics.max_drawdown_pct,
    }
    return {"trades": trades, "equity_curve": equity_curve, "metrics": metrics}


def main() -> None:
    payload = json.load(sys.stdin)
    strategy_code = payload["strategy_code"]
    bars = payload["bars"]
    initial_equity = payload.get("initial_equity", 10_000.0)

    namespace = {"__builtins__": SAFE_BUILTINS, "Signal": Signal, "Direction": Direction}
    try:
        exec(strategy_code, namespace)  # noqa: S102 -- this is the sandbox; executing the untrusted code is the point
    except Exception:
        print(json.dumps({"ok": False, "stage": "exec", "error": traceback.format_exc()}))
        return

    on_bar_fn = namespace.get("on_bar")
    if not callable(on_bar_fn):
        print(json.dumps({"ok": False, "stage": "exec", "error": "Generated code did not define a callable named on_bar."}))
        return

    try:
        data = build_dataframe(bars)
        strategy = GeneratedStrategy(on_bar_fn)
        result = run_backtest(data, strategy, initial_equity=initial_equity, truncate_visible_data=True)
    except Exception:
        print(json.dumps({"ok": False, "stage": "run", "error": traceback.format_exc()}))
        return

    times = [int(bar["time"]) for bar in bars]
    print(json.dumps({"ok": True, **serialize_result(result, times)}))


if __name__ == "__main__":
    main()
