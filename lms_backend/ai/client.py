import os
from functools import lru_cache

from anthropic import Anthropic


@lru_cache(maxsize=1)
def get_client() -> Anthropic:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key or "REPLACE" in api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Edit .env and restart the backend."
        )
    return Anthropic(api_key=api_key)


def get_model() -> str:
    return os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")
