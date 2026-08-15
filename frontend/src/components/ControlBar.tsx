import { DatePicker } from "./DatePicker";
import { TIMEFRAMES, MAX_LOOKBACK_DAYS } from "../constants";
import { addDaysISO, todayISO } from "../dateUtils";
import styles from "./ControlBar.module.css";

interface ControlBarProps {
  symbol: string;
  onSymbolChange: (value: string) => void;
  start: string;
  onStartChange: (value: string) => void;
  end: string;
  onEndChange: (value: string) => void;
  interval: string;
  onIntervalChange: (value: string) => void;
}

// Purely a controlled group of inputs now -- symbol/timeframe/dates all
// live as state in App.tsx, since both StrategyPanel's "Run backtest" and
// CodegenPanel's "Generate custom strategy" need the current values when
// their own buttons fire, not just this component's.
export function ControlBar({
  symbol,
  onSymbolChange,
  start,
  onStartChange,
  end,
  onEndChange,
  interval,
  onIntervalChange,
}: ControlBarProps) {
  const maxLookback = MAX_LOOKBACK_DAYS[interval];
  const today = todayISO();

  // `start` can't be more than maxLookback days before `end` -- anchored
  // to `end`, not "today", since a custom (earlier) end date should still
  // get the full window before it, not before whatever today happens to
  // be. `start` also can never land after `end`.
  const startMin = maxLookback !== undefined ? addDaysISO(end, -maxLookback) : undefined;
  const startMax = end;

  // `end` can't be before `start`, or in the future -- there's no data to
  // show past today regardless of interval.
  const endMin = start;
  const endMax = today;

  const timeframeLabel = TIMEFRAMES.find((t) => t.value === interval)?.label ?? interval;

  return (
    <div className={styles.bar}>
      <label className={styles.field}>
        <span className={styles.label}>Symbol</span>
        <input
          className={styles.input}
          value={symbol}
          onChange={(e) => onSymbolChange(e.target.value)}
          placeholder="AAPL"
          spellCheck={false}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Timeframe</span>
        <select className={styles.select} value={interval} onChange={(e) => onIntervalChange(e.target.value)}>
          {TIMEFRAMES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.dateRow}>
        <DatePicker label="Start" value={start} onChange={onStartChange} min={startMin} max={startMax} disableWeekends />
        <DatePicker label="End" value={end} onChange={onEndChange} min={endMin} max={endMax} disableWeekends />
      </div>

      {maxLookback !== undefined && (
        <span className={styles.hint}>
          {timeframeLabel} data only goes back {maxLookback} days on Yahoo Finance. Weekends aren't selectable --
          markets are closed.
        </span>
      )}
    </div>
  );
}
