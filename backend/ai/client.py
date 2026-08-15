from __future__ import annotations

from pathlib import Path

import anthropic
from dotenv import load_dotenv

# Explicit path rather than relying on load_dotenv()'s stack-walking search --
# this always resolves to backend/.env regardless of where the process is
# launched from (project root vs backend/, directly vs under uvicorn --reload).
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MODEL = "claude-sonnet-5"

_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment
    return _client
