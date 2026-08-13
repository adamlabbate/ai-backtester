import { useState } from "react";
import { ControlBar } from "./components/ControlBar";
import type { RunParams } from "./components/ControlBar";
import { Chart } from "./components/Chart";
import { EquityCurve } from "./components/EquityCurve";
import { MetricsPanel } from "./components/MetricsPanel";
import { TradeList } from "./components/TradeList";
import { runBacktest } from "./api";
import type { BacktestResult } from "./types";
import styles from "./App.module.css";

const INITIAL_EQUITY = 10_000;

function App() {
  // Three pieces of state cover every screen this app can be in: nothing
  // run yet (all null/false), running (loading true), succeeded (result
  // set), or failed (error set). The JSX below just reads these flags.
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun(params: RunParams) {
    setLoading(true);
    setError(null);
    try {
      const data = await runBacktest({
        ...params,
        fast_period: 10,
        slow_period: 30,
        stop_pct: 0.02,
        target_r: 2.0,
        initial_equity: INITIAL_EQUITY,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong running the backtest.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const finalEquity = result?.equity_curve.at(-1)?.equity ?? INITIAL_EQUITY;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.wordmark}>
          AI <span className={styles.accent}>BACKTESTER</span>
        </h1>
        <p className={styles.tagline}>event-driven strategy backtesting — no lookahead, by construction</p>
      </header>

      <ControlBar onRun={handleRun} loading={loading} />

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {result && (
        <div className={styles.results}>
          <Chart bars={result.bars} trades={result.trades} />
          <div className={styles.lowerGrid}>
            <EquityCurve points={result.equity_curve} initialEquity={INITIAL_EQUITY} />
            <MetricsPanel metrics={result.metrics} finalEquity={finalEquity} />
          </div>
          <TradeList trades={result.trades} />
        </div>
      )}

      {!result && !loading && !error && (
        <div className={styles.empty}>
          <p>Set a symbol and date range, then run a backtest.</p>
        </div>
      )}
    </div>
  );
}

export default App;
