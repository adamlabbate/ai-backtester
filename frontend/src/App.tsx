import { useState } from "react";
import { ControlBar } from "./components/ControlBar";
import type { RunParams } from "./components/ControlBar";
import { StrategyPanel } from "./components/StrategyPanel";
import type { StrategyState } from "./components/StrategyPanel";
import { CodegenPanel } from "./components/CodegenPanel";
import { Chart } from "./components/Chart";
import { EquityCurve } from "./components/EquityCurve";
import { MetricsPanel } from "./components/MetricsPanel";
import { TradeList } from "./components/TradeList";
import { runBacktest, generateStrategy } from "./api";
import type { RunResult } from "./types";
import styles from "./App.module.css";

const INITIAL_EQUITY = 10_000;

// Empty params means "use that template's own Python-side defaults" (see
// backend/ai/templates.py's build functions) -- this is what lets a fresh
// page load run a backtest before any AI interpretation has happened.
const DEFAULT_STRATEGY: StrategyState = { template: "ma_crossover", params: {} };

function App() {
  // `strategy` and `codegenDescription` are the two "what to run" inputs --
  // live even before either run button is pressed. `result` is unified
  // across both flows (see RunResult in types.ts): whichever one last
  // succeeded is what's on screen, tagged with `source` so the results
  // section knows which meta line to show.
  const [strategy, setStrategy] = useState<StrategyState>(DEFAULT_STRATEGY);
  const [codegenDescription, setCodegenDescription] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
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

  async function handleGenerateCustom(params: RunParams) {
    if (!codegenDescription.trim()) {
      setError("Describe a strategy in the custom strategy box before generating.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const data = await generateStrategy({
        ...params,
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

      <StrategyPanel strategy={strategy} onStrategyChange={setStrategy} />

      <CodegenPanel description={codegenDescription} onDescriptionChange={setCodegenDescription} />

      <ControlBar
        onRun={handleRun}
        loading={loading}
        onGenerateCustom={handleGenerateCustom}
        generating={generating}
      />

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {result && (
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
          <TradeList trades={result.trades} />
        </div>
      )}

      {!result && !loading && !generating && !error && (
        <div className={styles.empty}>
          <p>Set a symbol and date range, then run a backtest.</p>
        </div>
      )}
    </div>
  );
}

export default App;
