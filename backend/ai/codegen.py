from __future__ import annotations

from dataclasses import dataclass

from .client import MODEL, get_client
from .sandbox.ast_check import check_strategy_code
from .sandbox.docker_exec import SandboxExecutionError, run_in_sandbox

MAX_ATTEMPTS = 3

CODEGEN_SYSTEM_PROMPT = """You write exactly one Python function that implements a trading strategy for a backtesting engine, based on a plain-English description.

Write a single function:

    def on_bar(state):
        ...

It's called once per historical bar, only when no trade is currently open. Return a Signal(...) to open a trade, or None to do nothing on this bar.

Available names (already in scope -- do not import anything):
  - Signal(direction, stop, target, reason) -- direction is Direction.LONG or Direction.SHORT; stop and target are absolute prices; reason is a short string explaining why this signal fired.
  - Direction.LONG, Direction.SHORT
  - state.bars -- a pandas DataFrame of every bar up to and including now (columns: Open, High, Low, Close, Volume), oldest first. Use this for indicators, e.g. state.bars["Close"].rolling(20).mean().
  - state.current_bar -- the current bar as a pandas Series.
  - state.close, state.high, state.low -- floats for the current bar.

Rules:
  - Define exactly one function named on_bar, nothing else at module level.
  - No import statements -- pandas methods on state.bars are already available since it's a real DataFrame object; you just can't import new modules.
  - No eval, exec, open, getattr, setattr, delattr, or dunder attribute access (e.g. x.__class__) -- these are rejected before your code ever runs.
  - Entry price is implicitly the current bar's close; stop and target must be absolute prices you compute from state.close.
  - Only return a Signal when the strategy's entry condition is actually met on this bar -- return None otherwise.

Example, for "go long on a 20-bar breakout with a 2% stop":

    def on_bar(state):
        highs = state.bars["High"]
        if len(highs) < 21:
            return None
        breakout_level = highs.iloc[-21:-1].max()
        if state.close > breakout_level:
            entry = state.close
            stop = entry * 0.98
            target = entry + (entry - stop) * 2
            return Signal(direction=Direction.LONG, stop=stop, target=target, reason="broke above 20-bar high")
        return None
"""

CODE_TOOL = {
    "name": "submit_strategy_code",
    "description": "Submit the generated on_bar function implementing the requested strategy.",
    "input_schema": {
        "type": "object",
        "properties": {
            "code": {
                "type": "string",
                "description": "Complete Python source defining exactly one function: def on_bar(state): ...",
            },
        },
        "required": ["code"],
    },
}


@dataclass
class CodegenResult:
    code: str
    attempts: int
    trades: list[dict]
    equity_curve: list[dict]
    metrics: dict


class CodegenFailure(RuntimeError):
    """Raised when no working strategy was produced within MAX_ATTEMPTS.
    `attempt_log` has one human-readable entry per failed try, in order --
    useful for showing the user what actually went wrong rather than just
    "it didn't work"."""

    def __init__(self, message: str, attempt_log: list[str]):
        super().__init__(message)
        self.attempt_log = attempt_log


def generate_and_run_strategy(description: str, bars: list[dict], initial_equity: float) -> CodegenResult:
    """Generate a strategy from a plain-English description, and validate it
    by actually running it -- there's no meaningful distinction between
    "does this code work" and "what did it produce" here, so one sandboxed
    run serves both purposes.

    The retry loop is the brief's Phase 4 requirement: on a safety-check
    rejection or a runtime failure, the error is fed back to Claude as a
    tool_result (the standard way to continue an Anthropic tool-use
    conversation) so it can see exactly what went wrong and try again,
    capped at MAX_ATTEMPTS.
    """
    client = get_client()
    messages: list[dict] = [{"role": "user", "content": f"Strategy description: {description}"}]
    attempt_log: list[str] = []

    for attempt in range(1, MAX_ATTEMPTS + 1):
        response = client.messages.create(
            model=MODEL,
            max_tokens=1536,
            system=CODEGEN_SYSTEM_PROMPT,
            tools=[CODE_TOOL],
            tool_choice={"type": "any"},
            messages=messages,
        )

        tool_use = next((block for block in response.content if block.type == "tool_use"), None)
        if tool_use is None:
            attempt_log.append(f"Attempt {attempt}: Claude did not return code.")
            continue

        code = tool_use.input["code"]
        messages.append({"role": "assistant", "content": response.content})

        violations = check_strategy_code(code)
        if violations:
            feedback = "The generated code failed safety checks:\n" + "\n".join(violations)
            attempt_log.append(f"Attempt {attempt}: {feedback}")
            messages.append(
                {
                    "role": "user",
                    "content": [
                        {"type": "tool_result", "tool_use_id": tool_use.id, "content": feedback, "is_error": True}
                    ],
                }
            )
            continue

        try:
            result = run_in_sandbox(code, bars, initial_equity)
        except SandboxExecutionError as exc:
            feedback = f"The code ran but failed:\n{exc}"
            attempt_log.append(f"Attempt {attempt}: {feedback}")
            messages.append(
                {
                    "role": "user",
                    "content": [
                        {"type": "tool_result", "tool_use_id": tool_use.id, "content": feedback, "is_error": True}
                    ],
                }
            )
            continue

        return CodegenResult(
            code=code,
            attempts=attempt,
            trades=result["trades"],
            equity_curve=result["equity_curve"],
            metrics=result["metrics"],
        )

    raise CodegenFailure(f"Couldn't produce a working strategy after {MAX_ATTEMPTS} attempts.", attempt_log)
