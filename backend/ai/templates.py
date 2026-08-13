from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from ..engine.strategies.breakout import BreakoutStrategy
from ..engine.strategies.ma_crossover import MovingAverageCrossoverStrategy
from ..engine.strategies.mean_reversion import MeanReversionStrategy
from ..engine.strategy import Strategy

# Every template's schema includes `reasoning` as a required string. This
# isn't used to build the Strategy -- it's there so Claude's explanation for
# *why* it picked this template and these params comes back as a real,
# always-present structured field, rather than optional preamble text that
# tool-use calls sometimes skip entirely.
_REASONING_PROPERTY: dict[str, Any] = {
    "reasoning": {
        "type": "string",
        "description": "One sentence explaining why this template and these parameter values match the user's description.",
    }
}


@dataclass(frozen=True)
class StrategyTemplate:
    id: str
    label: str  # human-readable name, shown in the UI
    description: str  # shown to Claude so it knows when to pick this template
    input_schema: dict[str, Any]  # JSON schema for the Anthropic tool definition
    build: Callable[[dict[str, Any]], Strategy]


TEMPLATES: dict[str, StrategyTemplate] = {
    "ma_crossover": StrategyTemplate(
        id="ma_crossover",
        label="Moving average crossover",
        description=(
            "Trend-following: goes long when a fast moving average crosses above a slow one. "
            "Good fit for descriptions mentioning moving averages, golden cross, or trend-following."
        ),
        input_schema={
            "type": "object",
            "properties": {
                **_REASONING_PROPERTY,
                "fast_period": {"type": "integer", "description": "Bars in the fast moving average", "default": 10},
                "slow_period": {"type": "integer", "description": "Bars in the slow moving average", "default": 30},
                "stop_pct": {
                    "type": "number",
                    "description": "Stop-loss distance below entry, as a fraction (0.02 = 2%)",
                    "default": 0.02,
                },
                "target_r": {
                    "type": "number",
                    "description": "Profit target as a multiple of risk (2.0 = 2R)",
                    "default": 2.0,
                },
            },
            "required": ["reasoning"],
        },
        build=lambda p: MovingAverageCrossoverStrategy(**p),
    ),
    "breakout": StrategyTemplate(
        id="breakout",
        label="Breakout",
        description=(
            "Goes long when price closes above its highest high of the last N bars. Good fit for "
            "descriptions mentioning breakouts, new highs, Donchian channels, or range breaks."
        ),
        input_schema={
            "type": "object",
            "properties": {
                **_REASONING_PROPERTY,
                "lookback_period": {
                    "type": "integer",
                    "description": "Number of prior bars used to define the breakout level",
                    "default": 20,
                },
                "stop_pct": {"type": "number", "description": "Stop-loss distance below entry", "default": 0.02},
                "target_r": {"type": "number", "description": "Profit target as a multiple of risk", "default": 2.0},
            },
            "required": ["reasoning"],
        },
        build=lambda p: BreakoutStrategy(**p),
    ),
    "mean_reversion": StrategyTemplate(
        id="mean_reversion",
        label="Mean reversion",
        description=(
            "Goes long when price closes significantly below its recent average (a Bollinger-Band-style "
            "lower deviation), betting on a snap back toward the mean. Good fit for descriptions mentioning "
            "mean reversion, oversold conditions, pullbacks, or Bollinger Bands."
        ),
        input_schema={
            "type": "object",
            "properties": {
                **_REASONING_PROPERTY,
                "period": {
                    "type": "integer",
                    "description": "Bars used to compute the rolling mean and standard deviation",
                    "default": 20,
                },
                "num_std": {
                    "type": "number",
                    "description": "Standard deviations below the mean that triggers entry",
                    "default": 2.0,
                },
                "stop_pct": {"type": "number", "description": "Stop-loss distance below entry", "default": 0.02},
                "target_r": {"type": "number", "description": "Profit target as a multiple of risk", "default": 2.0},
            },
            "required": ["reasoning"],
        },
        build=lambda p: MeanReversionStrategy(**p),
    ),
}
