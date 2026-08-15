import { useState } from "react";
import { ControlBar } from "./components/ControlBar";
import { StrategyPanel } from "./components/StrategyPanel";
import type { StrategyState } from "./components/StrategyPanel";
import { CodegenPanel } from "./components/CodegenPanel";
import { Chart } from "./components/Chart";
import { EquityCurve } from "./components/EquityCurve";
import { MetricsPanel } from "./components/MetricsPanel";
import { TradeList } from "./components/TradeList";
import { runBacktest, generateStrategy } from "./api";
import type { RunResult } from "./types";
import { MAX_LOOKBACK_DAYS } from "./constants";
import { addDaysISO, todayISO } from "./dateUtils";
import styles from "./App.module.css";

const INITIAL_EQUITY = 10_000;

// Empty params means "use that template's own Python-side defaults" (see
// backend/ai/templates.py's build functions) -- this is what lets a fresh
// page load run a backtest before any AI interpretation has happened.
const DEFAULT_STRATEGY: StrategyState = { template: "ma_crossover", params: {} };

function App() {
  // Data-selection state -- symbol, date range, timeframe -- lives here,
  // not in ControlBar: both StrategyPanel's "Run backtest" and
  // CodegenPanel's "Generate custom strategy" need the current values when
  // their own buttons fire, so it has to be a shared ancestor's state.
  const [symbol, setSymbol] = useState("AAPL");
  const [start, setStart] = useState("2020-01-01");
  const [end, setEnd] = useState(() => todayISO());
  const [timeframe, setTimeframe] = useState("1d");

  const [strategy, setStrategy] = useState<StrategyState>(DEFAULT_STRATEGY);
  const [codegenDescription, setCodegenDescription] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Switching to a tighter interval while the date range still spans years
  // is exactly what used to silently fail (Yahoo just returns nothing for
  // an out-of-range request) -- pulling `start` back in to fit closes that
  // failure mode instead of just describing it after the fact. (DatePicker
  // also structurally prevents *new* out-of-range picks going forward --
  // this handles a range that was already selected before the switch.)
  function handleTimeframeChange(newTimeframe: string) {
    setTimeframe(newTimeframe);
    const maxDays = MAX_LOOKBACK_DAYS[newTimeframe];
    if (maxDays === undefined) return;
    const earliestAllowed = addDaysISO(end, -maxDays);
    if (start < earliestAllowed) {
      setStart(earliestAllowed);
    }
  }

  async function handleRun() {
    setLoading(true);
    setError(null);
    try {
      const data = await runBacktest({
        symbol: symbol.trim().toUpperCase(),
        start,
        end,
        interval: timeframe,
        strategy_template: strategy.template,
        strategy_params: strategy.params,
        initial_equity: INITIAL_EQUITY,
      });
      setResult({
        symbol: data.symbol,
        bars: data.bars,
        trades: data.trades,
        equity_curve: data.equity_curve,
        metrics: data.metrics,
        source: { kind: "template", template: data.strategy_template, params: data.strategy_params },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong running the backtest.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateCustom() {
    if (!codegenDescription.trim()) {
      setError("Describe a strategy in the custom strategy box before generating.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const data = await generateStrategy({
        symbol: symbol.trim().toUpperCase(),
        start,
        end,
        interval: timeframe,
        description: codegenDescription,
        initial_equity: INITIAL_EQUITY,
      });
      setResult({
        symbol: data.symbol,
        bars: data.bars,
        trades: data.trades,
        equity_curve: data.equity_curve,
        metrics: data.metrics,
        source: { kind: "codegen", code: data.code, attempts: data.attempts },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong generating that strategy.");
      setResult(null);
    } finally {
      setGenerating(false);
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

      <div className={styles.layout}>
        <div className={styles.main}>
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}

          {result ? (
            <div className={styles.results}>
              <div className={styles.resultsMeta}>
                {result.source.kind === "template" ? (
                  <p className={styles.resultsMetaLine}>
                    {result.symbol} · {result.source.template}
                    {Object.entries(result.source.params).length > 0 && (
                      <span className={styles.resultsMetaParams}>
                        {" "}
                        ({Object.entries(result.source.params)
                          .map(([key, value]) => `${key}=${value}`)
                          .join(", ")})
                      </span>
                    )}
                  </p>
                ) : (
                  <>
                    <p className={styles.resultsMetaLine}>
                      {result.symbol} · custom strategy
                      <span className={styles.resultsMetaParams}>
                        {" "}
                        (generated on attempt {result.source.attempts} of 3)
                      </span>
                    </p>
                    <details className={styles.codeDisclosure}>
                      <summary>View generated code</summary>
                      <pre className={styles.code}>{result.source.code}</pre>
                    </details>
                  </>
                )}
              </div>
              <Chart bars={result.bars} trades={result.trades} />
              <div className={styles.lowerGrid}>
                <EquityCurve points={result.equity_curve} initialEquity={INITIAL_EQUITY} />
                <MetricsPanel metrics={result.metrics} finalEquity={finalEquity} />
              </div>
            </div>
          ) : (
            <div className={styles.empty}>
              <p>Set a symbol and date range, then run a backtest.</p>
            </div>
          )}
        </div>

        <aside className={styles.sidebar}>
          <ControlBar
            symbol={symbol}
            onSymbolChange={setSymbol}
            start={start}
            onStartChange={setStart}
            end={end}
            onEndChange={setEnd}
            interval={timeframe}
            onIntervalChange={handleTimeframeChange}
          />
          <StrategyPanel strategy={strategy} onStrategyChange={setStrategy} onRun={handleRun} loading={loading} />
          <CodegenPanel
            description={codegenDescription}
            onDescriptionChange={setCodegenDescription}
            onGenerateCustom={handleGenerateCustom}
            generating={generating}
          />
        </aside>
      </div>

      {result && <TradeList trades={result.trades} />}
    </div>
  );
}

export default App;
