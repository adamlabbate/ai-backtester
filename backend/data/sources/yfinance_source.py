from __future__ import annotations

import pandas as pd
import yfinance as yf

# Yahoo Finance's own limits on how far back each interval can be queried,
# confirmed empirically against their API (undocumented, and yfinance
# doesn't validate this upfront -- it just silently returns an empty frame
# while logging an error to stderr). Checking this ourselves first turns
# that into a clear, specific error instead of a generic "no data returned."
# Intervals not listed here (1d, 1wk, 1mo, ...) have no such limit.
#
# These are the actual safe values, not the numbers Yahoo's error messages
# quote -- boundary-tested directly (e.g. "1h data ... must be within the
# last 730 days" actually rejects a 730-day span; 729 is the real limit).
# The off-by-one isn't consistent across interval groups either: 1m's
# quoted 8-day limit *is* inclusive (8 works), it's specifically the 60-
# and 730-day groups that are exclusive. Adjusted down where verified.
MAX_LOOKBACK_DAYS: dict[str, int] = {
    "1m": 8,
    "2m": 59,
    "5m": 59,
    "15m": 59,
    "30m": 59,
    "90m": 59,
    "1h": 729,
    "4h": 729,
}


def load_ohlcv(symbol: str, start: str, end: str, interval: str = "1d") -> pd.DataFrame:
    """Download historical OHLCV bars for `symbol` via yfinance.

    Returns a DataFrame indexed by date with Open/High/Low/Close/Volume
    columns, sorted oldest-to-newest -- the order the engine iterates in.
    """
    max_days = MAX_LOOKBACK_DAYS.get(interval)
    if max_days is not None:
        span_days = (pd.Timestamp(end) - pd.Timestamp(start)).days
        if span_days > max_days:
            raise ValueError(
                f"Yahoo Finance only serves {max_days} days of {interval!r} data per request "
                f"(requested {span_days} days: {start} to {end}). Try a shorter date range."
            )

    data = yf.download(symbol, start=start, end=end, interval=interval, progress=False, auto_adjust=True)
    if data.empty:
        raise ValueError(f"No data returned for {symbol} between {start} and {end}")

    if isinstance(data.columns, pd.MultiIndex):
        # yfinance returns a MultiIndex (field, ticker) when the ticker is
        # passed as part of a list internally -- flatten it to just the
        # field names (Open, High, Low, Close, Volume).
        data.columns = data.columns.get_level_values(0)

    return data.sort_index()
