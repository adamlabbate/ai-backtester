from __future__ import annotations

import pandas as pd


def to_unix_seconds(index: pd.DatetimeIndex) -> list[int]:
    """Convert a DatetimeIndex to Unix seconds, regardless of resolution or
    timezone-awareness.

    Daily/weekly bars from yfinance come back tz-naive; intraday bars (1h,
    4h, etc.) come back tz-aware (exchange-local, e.g. America/New_York).
    A plain `.astype("datetime64[s]")` raises outright on tz-aware data --
    normalize to UTC and drop the tz first, then convert. Either way this
    encodes the same underlying instant in time, just like any other Unix
    timestamp.
    """
    if index.tz is not None:
        index = index.tz_convert("UTC").tz_localize(None)
    return index.astype("datetime64[s]").astype("int64").tolist()
