# AI Backtester — Project Handoff

**What it is:** A full-stack trading strategy backtesting platform where a user describes a strategy in plain English, an LLM either maps it to a parametrized template or writes genuinely new Python code for it, and the result runs against real historical market data in a custom event-driven backtest engine — with a chart, equity curve, and trade list showing exactly what the strategy did and why, down to the individual signal.

Built solo, end to end (engine, API, React dashboard, two distinct AI integration patterns, sandboxed code execution) across ~1,650 lines of Python and ~1,200 lines of TypeScript. Repo: `ai-backtester` (GitHub, `adamlabbate/ai-backtester`).

---

## Resume-ready summary

> Designed and built an AI-powered trading strategy backtester from scratch: a custom event-driven backtest engine (Python) with a structural (not just conventional) guarantee against lookahead bias, a FastAPI backend, and a React/TypeScript dashboard with a candlestick chart (TradingView lightweight-charts) rendering strategy signals from the exact same state the engine used to generate them. Integrated the Claude API two ways — structured tool-use for safe template-parameter extraction, and full LLM code generation with a defense-in-depth sandbox (static AST analysis + ephemeral non-root Docker containers with no network access, resource limits, and a host-side timeout) for executing untrusted, model-written strategies. Found and fixed several real bugs along the way, including an undocumented off-by-one in a third-party API's rate limits (verified empirically, not assumed) and a timezone-handling crash in intraday data.

Pull whichever pieces of that are relevant per role — it's written to be choppable into 2-4 individual bullets.

---

## Architecture

```
backend/
  engine/          # Pure Python, zero web/AI deps. The actual backtesting logic.
    state.py         BacktestState — the anti-lookahead-bias mechanism (see below)
    strategy.py       Signal, Direction, Strategy protocol
    trade_manager.py  Position sizing, stop/target exit logic, R-multiples
    metrics.py         Win rate, expectancy, profit factor, max drawdown
    backtest.py         run_backtest() — the bar-by-bar loop
    strategies/          ma_crossover.py, breakout.py, mean_reversion.py
  data/sources/
    yfinance_source.py  Yahoo Finance data fetch + empirically-verified rate limits
  ai/
    templates.py         Registry of strategy templates (Claude tool schemas + factories)
    interpreter.py         Phase 3: plain English -> template + params (Claude tool use)
    codegen.py               Phase 4: plain English -> new Python code (retry loop)
    client.py                 Shared Anthropic client setup
    sandbox/
      ast_check.py             Static safety check on generated code
      runner.py                  Entrypoint that runs INSIDE the Docker container
      docker_exec.py              Host-side subprocess wrapper (resource limits, timeout)
      Dockerfile                    Sandbox image definition
  api/
    main.py           FastAPI app + CORS
    schemas.py          Pydantic request/response models
    timeutil.py           Timezone-safe timestamp conversion
    routes/
      backtest.py          POST /api/backtest
      chat.py                 POST /api/interpret-strategy, GET /api/templates
      codegen.py                POST /api/generate-strategy

frontend/src/
  App.tsx                    Orchestrates everything; two-column layout
  components/
    Chart.tsx                  lightweight-charts wrapper (candlesticks + signal markers)
    EquityCurve.tsx              Recharts area chart
    MetricsPanel.tsx               Stat tiles
    TradeList.tsx                    Trade table with a diverging R-multiple bar per row
    StrategyPanel.tsx                  Phase 3 UI: chat box + template/param editor
    CodegenPanel.tsx                     Phase 4 UI: chat box for custom strategies
    ControlBar.tsx                         Symbol/timeframe/date controls
    DatePicker.tsx                           Custom calendar (weekends/out-of-range disabled)
  dateUtils.ts, constants.ts             Shared date math and Yahoo API limits
```

**Data flow for a run:** browser → FastAPI route → `yfinance_source.load_ohlcv()` → engine's `run_backtest()` iterates bar-by-bar, building a `BacktestState` and calling the strategy's `on_bar()` → results (bars, trades, equity curve, metrics) serialize back as JSON → React renders the same trade data on both the chart and the trade list, so they can never disagree.

---

## What's built (all 4 phases from the original brief)

**Phase 1 — Engine core.** Event-driven, not vectorized: `BacktestState` exposes bars up to "now" only. Every strategy is just `on_bar(state) -> Signal | None`. `TradeManager` handles entries/exits/R-multiples; `metrics.py` computes win rate, expectancy, profit factor, max drawdown.

**Phase 2 — Dashboard.** FastAPI wraps the engine; React frontend renders a candlestick chart with entry/exit markers built from the *same* trade objects the metrics are computed from.

**Phase 3 — AI template matching.** Claude picks one of 3 strategy templates (MA crossover, breakout, mean reversion) and extracts parameters from a plain-English description, using tool use with `tool_choice="any"` — the model is structurally forced to call one of the template tools, so there's no code-execution risk at this phase.

**Phase 4 — Full code generation.** Claude writes a novel `on_bar` function from a description that doesn't fit any template. Safety pipeline: (1) static AST check rejects imports/eval/exec/file-I/O/dunder-attribute-access before anything runs, (2) runs inside an ephemeral Docker container — no network, read-only filesystem, memory/CPU/PID limits, non-root user, (3) a host-side wall-clock timeout force-kills runaway containers, (4) failures get fed back to Claude as a `tool_result` for up to 3 retry attempts. Verified end-to-end with strategies that have no template equivalent (volume-momentum, widest-range-breakout), and verified the sandbox boundaries directly (network/file-write/dunder-escape attempts all correctly blocked, infinite loop correctly killed with no orphaned container).

**Plus, beyond the original brief:** expanded timeframes (weekly down to 1-minute), a hand-built calendar widget (weekends/out-of-range dates structurally disabled, not just validated after the fact), and a two-column dashboard layout (chart dominant, sticky sidebar for controls/chat).

---

## Key technical decisions worth knowing about

- **Lookahead bias is prevented structurally, not by convention.** `BacktestState.bars`/`.current_bar`/`.close` all slice the dataset to `current_index`; a compliant strategy can't see the future because the data isn't in the object. For Phase 4's untrusted, AI-generated code specifically, `run_backtest()` has an opt-in `truncate_visible_data` flag (off by default, zero effect on hand-written strategies) that the sandbox always enables — with it on, `state.full_data` itself is truncated, so even a strategy that bypasses the sanctioned accessors and reaches for the raw attribute finds no future rows in memory to read.
- **Two different AI-safety models for two different tasks.** Template matching (Phase 3) is safe by *not generating code at all* — Claude only selects and parameterizes. Full generation (Phase 4) is safe by *assuming the code is hostile* and sandboxing accordingly, independent of whether the AST check catches everything.
- **Real bugs found by testing, not assumed away:**
  - Yahoo Finance's own quoted API limits are wrong at the exact boundary (a 730-day request for hourly data silently fails; 729 actually works) — found by direct boundary testing, not by trusting the documentation.
  - Intraday data comes back timezone-aware while daily data doesn't; the naive timestamp conversion crashed outright on it — caught before shipping by testing an actual hourly request, not just daily.
  - `lightweight-charts` renders its internal layout using an actual `<table>` element, which silently broke a Playwright selector during verification (`page.locator("table")` matched the chart's internals, not the trade list) — resolved by inspecting the DOM directly rather than guessing.

---

## How to run it

```bash
# Backend (from the repo root — NOT from inside backend/, imports break otherwise)
source backend/.venv/bin/activate
uvicorn backend.api.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

**Requirements:** `backend/.env` needs `ANTHROPIC_API_KEY=sk-ant-...` (gitignored, never committed). Docker Desktop must be running for the "Generate custom strategy" flow specifically — nothing else needs it. The sandbox image (`ai-backtester-sandbox`) is built via `docker build -t ai-backtester-sandbox -f backend/ai/sandbox/Dockerfile backend/`.

---

## What's left / known gaps

- **Phase 5 (bonus, from the original brief, not started):** Pine Script export for validated strategies; additional data sources (crypto via ccxt) — the engine is already data-source-agnostic, so this is mostly a new `data/sources/` module, not an engine change.
- **No persistence.** SQLite was in the original planned stack but never actually implemented — every backtest is stateless; there's no saved run history, no way to revisit a past result.
- **No automated test suite.** All verification so far has been manual/scripted (direct Python calls, `curl`, Playwright-driven browser screenshots) — nothing runs on its own via `pytest`/`vitest` yet.
- **Weekends-only calendar exclusion**, not full US market holidays (deliberate scope cut — holidays would need a calendar data source).

---

## Git history

```
cb57963 Restructure UI into two-column layout with a custom calendar widget
67fe759 Fix intraday timeframes: tz crash, silent range failures, more intervals
f944377 Add Phase 4: full strategy code generation with sandboxed execution
acdcee6 Remove backend/.env.example
d2b7e61 Add Phase 3: AI strategy template matching via Claude tool use
c5ad865 Add React dashboard (Phase 2): chart, equity curve, trade list, metrics
525d8ae Add FastAPI backend wrapping the backtest engine
f1e6a75 Implement Phase 1 backtest engine core
```

Each commit message has the full reasoning for that chunk of work — worth reading directly (`git log -p <hash>` or just `git show <hash>`) if you need more depth than this doc on any one phase.
