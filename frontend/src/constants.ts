export const TIMEFRAMES = [
  { value: "1wk", label: "Weekly" },
  { value: "1d", label: "Daily" },
  { value: "4h", label: "4 Hour" },
  { value: "1h", label: "1 Hour" },
  { value: "30m", label: "30 Min" },
  { value: "15m", label: "15 Min" },
  { value: "5m", label: "5 Min" },
  { value: "1m", label: "1 Min" },
];

// Mirrors backend/data/sources/yfinance_source.py's MAX_LOOKBACK_DAYS --
// the actual boundary-tested safe values (Yahoo's own quoted limits are
// off by one for some interval groups), kept in sync manually since these
// are stable API constraints, not application logic. Intervals absent
// here (1d, 1wk) have no such limit.
export const MAX_LOOKBACK_DAYS: Record<string, number> = {
  "1m": 8,
  "5m": 59,
  "15m": 59,
  "30m": 59,
  "1h": 729,
  "4h": 729,
};
