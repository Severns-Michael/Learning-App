from __future__ import annotations

import logging
from typing import Any

from ai.client import get_client, get_model
from ai.prompts import (
    EXPAND_NOTES_SYSTEM,
    EXTRACT_CONCEPTS_SYSTEM,
    GENERATE_STUDY_ITEMS_SYSTEM,
    POLISH_NOTES_SYSTEM,
)
from ai.tools import EXTRACT_CONCEPTS_TOOL, GENERATE_STUDY_ITEMS_TOOL

logger = logging.getLogger(__name__)


def enhance_notes(raw: str, mode: str = "polish") -> str:
    """Call Claude to improve notes.

    mode="polish": fix spelling/grammar/light structure, do NOT add content.
    mode="expand": fill in details, add facts, structure thoroughly.

    Returns the improved text. Does not modify the database.
    """
    system = EXPAND_NOTES_SYSTEM if mode == "expand" else POLISH_NOTES_SYSTEM
    client = get_client()
    response = client.messages.create(
        model=get_model(),
        max_tokens=8192,
        system=system,
        messages=[{"role": "user", "content": raw}],
    )
    usage = response.usage
    logger.info(
        "claude enhance_notes mode=%s: input=%s output=%s",
        mode,
        usage.input_tokens,
        usage.output_tokens,
    )
    for block in response.content:
        if getattr(block, "type", None) == "text":
            return block.text
    raise RuntimeError("Claude returned no text content.")


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


def generate_study_items(
    *,
    concept_summary: str,
    key_terms: list[dict] | None = None,
    blooms_level: str = "understand",
    connection_tags: list[str] | None = None,
    common_misconceptions: list[str] | None = None,
    source_text: str = "",
    section_terms: list[dict] | None = None,
) -> list[dict[str, Any]]:
    """Call Claude to generate 2-3 study items for one KU.

    `section_terms` (other KUs' key terms in the same section) is passed as
    context so Claude can build matching items that pull from a larger pool.

    Returns a list of item dicts shaped per GENERATE_STUDY_ITEMS_TOOL.
    """
    client = get_client()

    payload_lines = [f"Concept: {concept_summary}", f"Bloom level: {blooms_level}"]
    if key_terms:
        kt_text = "; ".join(
            f"{kt.get('term')} = {kt.get('definition')}" for kt in key_terms
        )
        payload_lines.append(f"Key terms: {kt_text}")
    if connection_tags:
        payload_lines.append(f"Tags: {', '.join(connection_tags)}")
    if common_misconceptions:
        misc = "; ".join(common_misconceptions)
        payload_lines.append(f"Common misconceptions: {misc}")
    if source_text:
        payload_lines.append(f"Source excerpt:\n{source_text}")
    if section_terms:
        # Other key terms from sibling KUs — context for matching exercises.
        other_text = "; ".join(
            f"{kt.get('term')} = {kt.get('definition')}" for kt in section_terms[:30]
        )
        payload_lines.append(f"Other section terms (matching pool): {other_text}")

    response = client.messages.create(
        model=get_model(),
        max_tokens=8192,
        system=[
            {
                "type": "text",
                "text": GENERATE_STUDY_ITEMS_SYSTEM,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": "\n\n".join(payload_lines)}],
        tools=[GENERATE_STUDY_ITEMS_TOOL],
        tool_choice={"type": "tool", "name": "generate_study_items"},
    )

    usage = response.usage
    logger.info(
        "claude generate_study_items: input=%s cached_read=%s cached_write=%s output=%s",
        usage.input_tokens,
        getattr(usage, "cache_read_input_tokens", 0),
        getattr(usage, "cache_creation_input_tokens", 0),
        usage.output_tokens,
    )

    for block in response.content:
        if (
            getattr(block, "type", None) == "tool_use"
            and block.name == "generate_study_items"
        ):
            return block.input.get("items", [])

    raise RuntimeError("Claude did not call the generate_study_items tool.")
