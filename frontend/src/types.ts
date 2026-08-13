// Mirrors backend/api/schemas.py -- kept as plain interfaces (not classes)
// since this is just the shape of JSON coming over the wire.

export type Direction = "long" | "short";

export interface Bar {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Trade {
  direction: Direction;
  entry_price: number;
  exit_price: number;
  stop: number;
  target: number;
  entry_time: number; // unix seconds
  exit_time: number; // unix seconds
  r_multiple: number;
  pnl: number;
  reason: string;
}

export interface EquityPoint {
  time: number; // unix seconds
  equity: number;
}

export interface Metrics {
  total_trades: number;
  win_rate: number;
  expectancy: number;
  profit_factor: number | null;
  max_drawdown_pct: number;
}

export interface BacktestResult {
  symbol: string;
  strategy_template: string;
  strategy_params: Record<string, number>;
  bars: Bar[];
  trades: Trade[];
  equity_curve: EquityPoint[];
  metrics: Metrics;
}

export interface BacktestParams {
  symbol: string;
  start: string;
  end: string;
  interval: string;
  initial_equity: number;
  strategy_template: string;
  strategy_params: Record<string, number>;
}

// A single strategy's tunable parameter, as described by the backend's
// template registry (backend/ai/templates.py) -- the frontend builds its
// param inputs from this rather than hardcoding each template's shape.
export interface TemplateParamInfo {
  name: string;
  type: "integer" | "number";
  description: string;
  default: number | null;
}

export interface TemplateInfo {
  id: string;
  label: string;
  description: string;
  params: TemplateParamInfo[];
}

// What Claude returned when asked to match a plain-English description to a
// template -- `reasoning` is always present (see backend/ai/templates.py's
// _REASONING_PROPERTY) so there's always something to show the user.
export interface InterpretResult {
  template: string;
  label: string;
  params: Record<string, number>;
  reasoning: string;
}
