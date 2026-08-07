from __future__ import annotations

import pandas as pd
import yfinance as yf


def load_ohlcv(symbol: str, start: str, end: str, interval: str = "1d") -> pd.DataFrame:
    """Download historical OHLCV bars for `symbol` via yfinance.

    Returns a DataFrame indexed by date with Open/High/Low/Close/Volume
    columns, sorted oldest-to-newest -- the order the engine iterates in.
    """
    data = yf.download(symbol, start=start, end=end, interval=interval, progress=False, auto_adjust=True)
    if data.empty:
        raise ValueError(f"No data returned for {symbol} between {start} and {end}")

    if isinstance(data.columns, pd.MultiIndex):
        # yfinance returns a MultiIndex (field, ticker) when the ticker is
        # passed as part of a list internally -- flatten it to just the
        # field names (Open, High, Low, Close, Volume).
        data.columns = data.columns.get_level_values(0)

    return data.sort_index()
