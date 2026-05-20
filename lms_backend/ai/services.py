from __future__ import annotations

import logging
from typing import Any

from ai.client import get_client, get_model
from ai.prompts import EXTRACT_CONCEPTS_SYSTEM
from ai.tools import EXTRACT_CONCEPTS_TOOL

logger = logging.getLogger(__name__)


def extract_concepts(notes: str, section_title: str = "") -> list[dict[str, Any]]:
    """Call Claude to turn raw notes into a list of knowledge unit dicts.

    Returns a list shaped per EXTRACT_CONCEPTS_TOOL's input_schema.knowledge_units.
    Raises RuntimeError if Claude returns nothing usable.
    """
    client = get_client()
    user_content = (
        f"Section: {section_title}\n\nNotes:\n{notes}" if section_title else notes
    )

    response = client.messages.create(
        model=get_model(),
        max_tokens=8192,
        system=[
            {
                "type": "text",
                "text": EXTRACT_CONCEPTS_SYSTEM,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_content}],
        tools=[EXTRACT_CONCEPTS_TOOL],
        tool_choice={"type": "tool", "name": "extract_concepts"},
    )

    usage = response.usage
    logger.info(
        "claude extract_concepts: input=%s cached_read=%s cached_write=%s output=%s",
        usage.input_tokens,
        getattr(usage, "cache_read_input_tokens", 0),
        getattr(usage, "cache_creation_input_tokens", 0),
        usage.output_tokens,
    )

    for block in response.content:
        if getattr(block, "type", None) == "tool_use" and block.name == "extract_concepts":
            return block.input.get("knowledge_units", [])

    raise RuntimeError("Claude did not call the extract_concepts tool.")
