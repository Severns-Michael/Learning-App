from __future__ import annotations

import logging
from typing import Any

from ai.client import get_client, get_model
from ai.prompts import (
    EXPAND_NOTES_SYSTEM,
    EXTRACT_CONCEPTS_SYSTEM,
    FILL_BLANKS_NOTES_SYSTEM,
    GENERATE_STUDY_ITEMS_SYSTEM,
    POLISH_NOTES_SYSTEM,
    REWRITE_PASSAGE_SYSTEM,
)
from ai.tools import EXTRACT_CONCEPTS_TOOL, GENERATE_STUDY_ITEMS_TOOL

logger = logging.getLogger(__name__)


def _context_prefix(course_title: str = "", section_title: str = "") -> str:
    """Build a short context block that tells Claude what study material this is.

    Injected as the first lines of the user message (not the system prompt) so
    it doesn't bust the cache. Helps Claude calibrate terminology, difficulty,
    and what counts as 'adjacent' vs 'in-scope' material.
    """
    parts = []
    if course_title:
        parts.append(f"Course: {course_title}")
    if section_title:
        parts.append(f"Section: {section_title}")
    return "\n".join(parts)


def _claude_text(
    *,
    system: str,
    user: str,
    max_tokens: int = 8192,
    log_label: str,
    course_title: str = "",
    section_title: str = "",
) -> str:
    """Single-turn text-only Claude call. Shared by enhance_notes / rewrite_passage.

    The system prompt is sent with cache_control so repeat calls within ~5 min
    re-use the cached prefix (cheaper input tokens, lower latency).
    """
    prefix = _context_prefix(course_title, section_title)
    user_content = f"{prefix}\n\n{user}" if prefix else user
    client = get_client()
    response = client.messages.create(
        model=get_model(),
        max_tokens=max_tokens,
        system=[
            {
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_content}],
    )
    usage = response.usage
    logger.info(
        "%s: input=%s cached_read=%s cached_write=%s output=%s",
        log_label,
        usage.input_tokens,
        getattr(usage, "cache_read_input_tokens", 0),
        getattr(usage, "cache_creation_input_tokens", 0),
        usage.output_tokens,
    )
    for block in response.content:
        if getattr(block, "type", None) == "text":
            return block.text
    raise RuntimeError(f"{log_label}: Claude returned no text content.")


def enhance_notes(
    raw: str,
    mode: str = "polish",
    *,
    course_title: str = "",
    section_title: str = "",
) -> str:
    """Call Claude to improve notes.

    mode="polish":      fix spelling/grammar/light structure, do NOT add content.
    mode="expand":      fill in details, add facts, structure thoroughly.
    mode="fill_blanks": replace `$$` blanks with definitions, leaving the rest
                        of the notes untouched.

    Returns the improved text. Does not modify the database.
    """
    system = {
        "expand": EXPAND_NOTES_SYSTEM,
        "fill_blanks": FILL_BLANKS_NOTES_SYSTEM,
    }.get(mode, POLISH_NOTES_SYSTEM)
    return _claude_text(
        system=system,
        user=raw,
        log_label=f"claude enhance_notes mode={mode}",
        course_title=course_title,
        section_title=section_title,
    )


def rewrite_passage(
    *,
    original: str,
    previous: str = "",
    instruction: str,
    context_before: str = "",
    context_after: str = "",
    course_title: str = "",
    section_title: str = "",
) -> str:
    """Ask Claude to rewrite a specific passage following a user instruction.

    Used by the per-hunk regenerate flow in the AI diff modal. Returns the
    rewritten text only.
    """
    parts = []
    if context_before:
        parts.append(f"CONTEXT_BEFORE:\n{context_before}")
    parts.append(f"ORIGINAL:\n{original}")
    if previous:
        parts.append(f"PREVIOUS AI VERSION (rejected):\n{previous}")
    parts.append(f"INSTRUCTION: {instruction}")
    if context_after:
        parts.append(f"CONTEXT_AFTER:\n{context_after}")
    return _claude_text(
        system=REWRITE_PASSAGE_SYSTEM,
        user="\n\n".join(parts),
        max_tokens=4096,
        log_label="claude rewrite_passage",
        course_title=course_title,
        section_title=section_title,
    )


def extract_concepts(
    notes: str,
    section_title: str = "",
    *,
    course_title: str = "",
) -> list[dict[str, Any]]:
    """Call Claude to turn raw notes into a list of knowledge unit dicts.

    Returns a list shaped per EXTRACT_CONCEPTS_TOOL's input_schema.knowledge_units.
    Raises RuntimeError if Claude returns nothing usable.
    """
    client = get_client()
    prefix = _context_prefix(course_title, section_title)
    user_content = f"{prefix}\n\nNotes:\n{notes}" if prefix else notes

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
    course_title: str = "",
    section_title: str = "",
) -> list[dict[str, Any]]:
    """Call Claude to generate 2-3 study items for one KU.

    `section_terms` (other KUs' key terms in the same section) is passed as
    context so Claude can build matching items that pull from a larger pool.

    Returns a list of item dicts shaped per GENERATE_STUDY_ITEMS_TOOL.
    """
    client = get_client()

    payload_lines = []
    prefix = _context_prefix(course_title, section_title)
    if prefix:
        payload_lines.append(prefix)
    payload_lines.extend([f"Concept: {concept_summary}", f"Bloom level: {blooms_level}"])
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
