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
  fast_period: number;
  slow_period: number;
  stop_pct: number;
  target_r: number;
  initial_equity: number;
}
