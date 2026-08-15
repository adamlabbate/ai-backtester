from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ...ai.codegen import CodegenFailure, generate_and_run_strategy
from ...data.sources.yfinance_source import load_ohlcv
from ..schemas import BarOut, GenerateStrategyRequest, GenerateStrategyResponse
from ..timeutil import to_unix_seconds

router = APIRouter()


@router.post("/generate-strategy", response_model=GenerateStrategyResponse)
def generate_strategy_endpoint(request: GenerateStrategyRequest) -> GenerateStrategyResponse:
    """Phase 4: Claude writes a genuinely new on_bar function from a
    plain-English description (not a pick from ai/templates.py), and it's
    validated by actually running it in the Docker sandbox -- see
    ai/codegen.py for the generate -> safety-check -> sandbox -> retry loop.

    This is slower and heavier than /api/backtest or /api/interpret-strategy
    (up to 3 Claude calls plus up to 3 fresh containers), which is exactly
    why it's a separate endpoint the frontend calls explicitly rather than
    something blended into the quicker template-matching flow.
    """
    try:
        data = load_ohlcv(request.symbol, start=request.start, end=request.end, interval=request.interval)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    times = to_unix_seconds(data.index)
    bars = [
        {
            "time": times[i],
            "Open": float(data["Open"].iloc[i]),
            "High": float(data["High"].iloc[i]),
            "Low": float(data["Low"].iloc[i]),
            "Close": float(data["Close"].iloc[i]),
            "Volume": float(data["Volume"].iloc[i]),
        }
        for i in range(len(data))
    ]

    try:
        result = generate_and_run_strategy(request.description, bars, request.initial_equity)
    except CodegenFailure as exc:
        detail = str(exc)
        if exc.attempt_log:
            detail += "\n\n" + "\n\n".join(exc.attempt_log)
        raise HTTPException(status_code=422, detail=detail) from exc

    bars_out = [
        BarOut(
            time=times[i],
            open=float(data["Open"].iloc[i]),
            high=float(data["High"].iloc[i]),
            low=float(data["Low"].iloc[i]),
            close=float(data["Close"].iloc[i]),
            volume=float(data["Volume"].iloc[i]),
        )
        for i in range(len(data))
    ]

    # result.trades / .equity_curve / .metrics are already plain dicts
    # shaped exactly like TradeOut / EquityPoint / MetricsOut (see
    # ai/sandbox/runner.py's serialize_result, which runs inside the
    # container and can't import these Pydantic schemas) -- Pydantic
    # validates and coerces them into the real models here.
    return GenerateStrategyResponse(
        symbol=request.symbol,
        code=result.code,
        attempts=result.attempts,
        bars=bars_out,
        trades=result.trades,
        equity_curve=result.equity_curve,
        metrics=result.metrics,
    )
