import type {
  BacktestParams,
  BacktestResult,
  GenerateStrategyParams,
  GenerateStrategyResult,
  InterpretResult,
  TemplateInfo,
} from "./types";

// import.meta.env is Vite's mechanism for build-time config -- reads from
// .env files or the shell environment, falls back to localhost for local
// dev where no .env is set up.
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    // FastAPI's HTTPException (see backend/api/routes/*.py) shapes errors
    // as { detail: "..." } -- fall back to a generic message if the body
    // isn't that shape (e.g. a network-level failure).
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.detail ?? `Request failed with status ${response.status}`);
  }

  return response.json();
}

export async function runBacktest(params: BacktestParams): Promise<BacktestResult> {
  return postJson<BacktestResult>("/api/backtest", params);
}

export async function interpretStrategy(description: string): Promise<InterpretResult> {
  return postJson<InterpretResult>("/api/interpret-strategy", { description });
}

export async function fetchTemplates(): Promise<TemplateInfo[]> {
  const response = await fetch(`${API_BASE}/api/templates`);
  if (!response.ok) {
    throw new Error(`Failed to load strategy templates (status ${response.status})`);
  }
  return response.json();
}

export async function generateStrategy(params: GenerateStrategyParams): Promise<GenerateStrategyResult> {
  return postJson<GenerateStrategyResult>("/api/generate-strategy", params);
}
