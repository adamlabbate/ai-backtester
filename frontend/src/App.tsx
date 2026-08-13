import { useState } from "react";
import { ControlBar } from "./components/ControlBar";
import type { RunParams } from "./components/ControlBar";
import { StrategyPanel } from "./components/StrategyPanel";
import type { StrategyState } from "./components/StrategyPanel";
import { Chart } from "./components/Chart";
import { EquityCurve } from "./components/EquityCurve";
import { MetricsPanel } from "./components/MetricsPanel";
import { TradeList } from "./components/TradeList";
import { runBacktest } from "./api";
import type { BacktestResult } from "./types";
import styles from "./App.module.css";

const INITIAL_EQUITY = 10_000;

// Empty params means "use that template's own Python-side defaults" (see
// backend/ai/templates.py's build functions) -- this is what lets a fresh
// page load run a backtest before any AI interpretation has happened.
const DEFAULT_STRATEGY: StrategyState = { template: "ma_crossover", params: {} };

function App() {
  // Four pieces of state cover every screen this app can be in: nothing run
  // yet (all null/false), running (loading true), succeeded (result set),
  // or failed (error set). `strategy` is separate -- it's the AI/manual
  // strategy picker's current selection, live even before a run happens.
  const [strategy, setStrategy] = useState<StrategyState>(DEFAULT_STRATEGY);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun(params: RunParams) {
    setLoading(true);
    setError(null);
    try {
      const data = await runBacktest({
        ...params,
        strategy_template: strategy.template,
        strategy_params: strategy.params,
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

      <StrategyPanel strategy={strategy} onStrategyChange={setStrategy} />

      <ControlBar onRun={handleRun} loading={loading} />

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {result && (
        <div className={styles.results}>
          <p className={styles.resultsMeta}>
            {result.symbol} · {result.strategy_template}
            {Object.entries(result.strategy_params).length > 0 && (
              <span className={styles.resultsMetaParams}>
                {" "}
                ({Object.entries(result.strategy_params)
                  .map(([key, value]) => `${key}=${value}`)
                  .join(", ")})
              </span>
            )}
          </p>
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
