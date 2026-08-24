# Setup on a new machine

Bootstrap guide for getting this project running from scratch (e.g. after
moving to a new laptop). For what the project *is* and what's left to build,
see [HANDOFF.md](HANDOFF.md) — read that after this to pick up where things
left off.

## Prerequisites to install first

- **Python 3.13** (or close to it — nothing here depends on bleeding-edge
  features, but this is what it was built and tested against)
- **Node.js** (v20+; was built against v25) — installs `npm`
- **Docker Desktop** — only required for the "Generate custom strategy"
  (Phase 4) flow specifically. Everything else works without it.
- **git**

On macOS, Homebrew covers Python/Node/git; Docker Desktop is a separate
installer from docker.com. Note: on Apple Silicon Homebrew installs to
`/opt/homebrew/bin`, not `/usr/local/bin` — matters if a shell's `PATH`
ever seems to be missing `node`/`npm`/`docker` despite them being installed.

## 1. Clone the repo

```bash
git clone https://github.com/adamlabbate/ai-backtester.git
cd ai-backtester
```

## 2. Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env` (gitignored — this does **not** come from git clone,
it has to be recreated on every machine) with:

```
ANTHROPIC_API_KEY=sk-ant-...
```

This key needs API billing set up separately from any claude.ai subscription
— see console.anthropic.com. Without it, everything works except the
"Interpret strategy" and "Generate custom strategy" AI features.

## 3. Frontend setup

```bash
cd frontend
npm install
```

## 4. Docker sandbox image (only needed for Phase 4 / custom code generation)

```bash
docker build -t ai-backtester-sandbox -f backend/ai/sandbox/Dockerfile backend/
```

Rebuild this if `backend/engine/` or `backend/ai/sandbox/runner.py` ever
change, since the image bakes in a copy of both.

## 5. Run it

Two terminals, both from the repo root:

```bash
# Terminal 1 — backend (must run from repo root, not from inside backend/ —
# it's a dotted Python module path, breaks otherwise)
source backend/.venv/bin/activate
uvicorn backend.api.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Quick smoke test

- Page loads, shows the empty state and the sidebar controls → frontend/backend are talking.
- Click "Run backtest" with the defaults (AAPL, daily, moving average crossover) → chart, equity curve, and trade list populate → engine + data source work.
- Type a strategy description and click "Interpret strategy" → a template match with reasoning appears → Anthropic API key works.
- (Requires Docker running) Describe something novel in "Write a custom strategy" and click "Generate custom strategy" → code appears after a few seconds → sandbox works end to end.

If something fails, `HANDOFF.md`'s "Key technical decisions" section documents a few real bugs already hit and fixed (timezone crashes, an off-by-one in Yahoo's rate limits, wrong working directory breaking Python's module resolution) — worth checking there before re-diagnosing from scratch.
