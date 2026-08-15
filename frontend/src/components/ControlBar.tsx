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
  { value: "1d", label: "Daily" },
  { value: "1h", label: "Hourly" },
  { value: "1wk", label: "Weekly" },
];

export function ControlBar({ onRun, loading, onGenerateCustom, generating }: ControlBarProps) {
  // useState gives each of these a piece of state plus a setter function;
  // React re-renders this component whenever a setter is called, which is
  // how the input boxes below stay in sync with what's typed into them
  // ("controlled inputs" -- the input's value always comes from React
  // state, never from the DOM directly).
  const [symbol, setSymbol] = useState("AAPL");
  const [start, setStart] = useState("2020-01-01");
  const [end, setEnd] = useState("2024-01-01");
  const [timeframe, setTimeframe] = useState("1d");

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

  const isIntraday = timeframe !== "1d" && timeframe !== "1wk";

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
        <select className={styles.select} value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
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
          onChange={(e) => setStart(e.target.value)}
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

      {isIntraday && (
        <span className={styles.hint}>Intraday data only goes back ~2 years — older ranges may return nothing.</span>
      )}
    </form>
  );
}
