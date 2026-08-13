import type { BacktestParams, BacktestResult } from "./types";

// import.meta.env is Vite's mechanism for build-time config -- reads from
// .env files or the shell environment, falls back to localhost for local
// dev where no .env is set up.
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

export async function runBacktest(params: BacktestParams): Promise<BacktestResult> {
  const response = await fetch(`${API_BASE}/api/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    // FastAPI's HTTPException (see backend/api/routes/backtest.py) shapes
    // errors as { detail: "..." } -- fall back to a generic message if the
    // body isn't that shape (e.g. a network-level failure).
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed with status ${response.status}`);
  }

  return response.json();
}
