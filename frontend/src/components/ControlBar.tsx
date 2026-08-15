import { useState } from "react";
import type { FormEvent } from "react";
import styles from "./ControlBar.module.css";

export interface RunParams {
  symbol: string;
  start: string;
  end: string;
  interval: string;
}

interface ControlBarProps {
  onRun: (params: RunParams) => void;
  loading: boolean;
  onGenerateCustom: (params: RunParams) => void;
  generating: boolean;
}

const TIMEFRAMES = [
  { value: "1wk", label: "Weekly" },
  { value: "1d", label: "Daily" },
  { value: "4h", label: "4 Hour" },
  { value: "1h", label: "1 Hour" },
  { value: "30m", label: "30 Min" },
  { value: "15m", label: "15 Min" },
  { value: "5m", label: "5 Min" },
  { value: "1m", label: "1 Min" },
];

// Yahoo Finance's own lookback limits per interval, confirmed empirically
// (see backend/data/sources/yfinance_source.py's MAX_LOOKBACK_DAYS -- same
// numbers, kept in sync manually since these are stable API constraints,
// not application logic). Intervals absent here (1d, 1wk) have no limit.
const MAX_LOOKBACK_DAYS: Record<string, number> = {
  "1m": 8,
  "5m": 60,
  "15m": 60,
  "30m": 60,
  "1h": 730,
  "4h": 730,
};

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function ControlBar({ onRun, loading, onGenerateCustom, generating }: ControlBarProps) {
  // useState gives each of these a piece of state plus a setter function;
  // React re-renders this component whenever a setter is called, which is
  // how the input boxes below stay in sync with what's typed into them
  // ("controlled inputs" -- the input's value always comes from React
  // state, never from the DOM directly).
  const [symbol, setSymbol] = useState("AAPL");
  const [start, setStart] = useState("2020-01-01");
  // "Today," not a fixed date -- a hardcoded end date silently becomes a
  // stale range as real time moves past it, and (worse) can end up *before*
  // an auto-adjusted start date below, producing an inverted range that
  // just hangs against a real API instead of failing clearly.
  const [end, setEnd] = useState(() => daysAgo(0));
  const [timeframe, setTimeframe] = useState("1d");
  const [autoAdjusted, setAutoAdjusted] = useState(false);

  function currentParams(): RunParams {
    return { symbol: symbol.trim().toUpperCase(), start, end, interval: timeframe };
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onRun(currentParams());
  }

  function handleGenerateClick() {
    onGenerateCustom(currentParams());
  }

  // Switching to a tighter interval while the date range still spans years
  // is exactly what silently failed before (Yahoo just returns nothing for
  // an out-of-range request) -- pulling `start` back in to fit closes that
  // failure mode instead of just describing it after the fact.
  function handleTimeframeChange(newInterval: string) {
    setTimeframe(newInterval);
    const maxDays = MAX_LOOKBACK_DAYS[newInterval];
    const earliestAllowed = maxDays !== undefined ? daysAgo(maxDays) : null;
    if (earliestAllowed !== null && start < earliestAllowed) {
      setStart(earliestAllowed);
      // If `end` was set further back than the new `start`, pulling only
      // `start` in would leave an inverted range (start after end) --
      // bump `end` to today too in that case.
      if (end < earliestAllowed) {
        setEnd(daysAgo(0));
      }
      setAutoAdjusted(true);
    } else {
      setAutoAdjusted(false);
    }
  }

  const maxLookback = MAX_LOOKBACK_DAYS[timeframe];
  const timeframeLabel = TIMEFRAMES.find((t) => t.value === timeframe)?.label ?? timeframe;

  return (
    <form className={styles.bar} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span className={styles.label}>Symbol</span>
        <input
          className={styles.input}
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="AAPL"
          spellCheck={false}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Timeframe</span>
        <select className={styles.select} value={timeframe} onChange={(e) => handleTimeframeChange(e.target.value)}>
          {TIMEFRAMES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Start</span>
        <input
          className={styles.input}
          type="date"
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            setAutoAdjusted(false);
          }}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>End</span>
        <input className={styles.input} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </label>

      <button className={styles.run} type="submit" disabled={loading || generating}>
        {loading ? "Running…" : "Run backtest"}
      </button>

      <button
        className={styles.generate}
        type="button"
        disabled={loading || generating}
        onClick={handleGenerateClick}
      >
        {generating ? "Generating…" : "Generate custom strategy"}
      </button>

      {maxLookback !== undefined && (
        <span className={styles.hint}>
          {autoAdjusted
            ? `Start date pulled in to fit — Yahoo only serves ${maxLookback} days of ${timeframeLabel.toLowerCase()} data per request.`
            : `${timeframeLabel} data only goes back ${maxLookback} days on Yahoo Finance.`}
        </span>
      )}
    </form>
  );
}
