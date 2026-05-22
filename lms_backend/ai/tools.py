GENERATE_STUDY_ITEMS_TOOL = {
    "name": "generate_study_items",
    "description": (
        "Save 2–3 study cards for one knowledge unit. Mix of MC, fill-in-blank "
        "(stored with MC distractors), and optionally matching when there are "
        "enough term/definition pairs. Always call this tool — do not reply in prose."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "minItems": 2,
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "properties": {
                        "mode": {
                            "type": "string",
                            "enum": ["mc", "fill_blank", "matching"],
                        },
                        "prompt": {"type": "string"},
                        "answer": {
                            "type": "string",
                            "description": (
                                "The correct answer. Required for mode=mc and "
                                "mode=fill_blank. Leave empty string for matching."
                            ),
                        },
                        "explanation": {
                            "type": "string",
                            "description": "Optional. 1-sentence reason the answer is correct.",
                        },
                        "distractors": {
                            "type": "array",
                            "description": (
                                "EXACTLY 3 entries for mc and fill_blank. "
                                "Empty array for matching."
                            ),
                            "items": {
                                "type": "object",
                                "properties": {
                                    "text": {"type": "string"},
                                    "why_wrong": {"type": "string"},
                                },
                                "required": ["text", "why_wrong"],
                            },
                        },
                        "pairs": {
                            "type": "array",
                            "description": (
                                "Required for mode=matching. 4–6 term↔definition pairs."
                            ),
                            "items": {
                                "type": "object",
                                "properties": {
                                    "term": {"type": "string"},
                                    "definition": {"type": "string"},
                                },
                                "required": ["term", "definition"],
                            },
                        },
                        "blooms_level": {
                            "type": "string",
                            "enum": [
                                "remember",
                                "understand",
                                "apply",
                                "analyze",
                                "evaluate",
                                "create",
                            ],
                        },
                    },
                    "required": ["mode", "prompt", "blooms_level"],
                },
            },
        },
        "required": ["items"],
    },
}


EXTRACT_CONCEPTS_TOOL = {
    "name": "extract_concepts",
    "description": (
        "Save a list of topic-sized knowledge units extracted from study notes. "
        "Each KU is broader than a single fact and narrower than a section — "
        "the right size to support 2–3 distinct test questions. Always call this "
        "tool — do not reply in prose."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "knowledge_units": {
                "type": "array",
                "description": "Topic-sized knowledge units extracted from the notes.",
                "items": {
                    "type": "object",
                    "properties": {
                        "concept_summary": {
                            "type": "string",
                            "description": (
                                "Two- to four-sentence self-contained statement naming "
                                "the topic and what it covers, including key sub-concepts. "
                                "Avoid filler like 'this section covers'."
                            ),
                        },
                        "source_chunk": {
                            "type": "string",
                            "description": (
                                "The verbatim slice of the original notes this unit came from. "
                                "Used for provenance and to seed distractors later."
                            ),
                        },
                        "key_terms": {
                            "type": "array",
                            "minItems": 2,
                            "description": (
                                "Vocabulary central to this topic with one-line definitions. "
                                "Three to six entries typical. Required because matching items "
                                "are built from these pairs."
                            ),
                            "items": {
                                "type": "object",
                                "properties": {
                                    "term": {"type": "string"},
                                    "definition": {"type": "string"},
                                },
                                "required": ["term", "definition"],
                            },
                        },
                        "blooms_level": {
                            "type": "string",
                            "enum": [
                                "remember",
                                "understand",
                                "apply",
                                "analyze",
                                "evaluate",
                                "create",
                            ],
                        },
                        "connection_tags": {
                            "type": "array",
                            "description": (
                                "1–4 short lower-case-with-hyphens topic tags "
                                "(e.g. 'encryption', 'session-management')."
                            ),
                            "items": {"type": "string"},
                        },
                        "common_misconceptions": {
                            "type": "array",
                            "description": (
                                "Optional. Well-known confusions students have with THIS "
                                "concept. Omit (don't fabricate) if nothing comes to mind."
                            ),
                            "items": {"type": "string"},
                        },
                    },
                    "required": [
                        "concept_summary",
                        "source_chunk",
                        "key_terms",
                        "blooms_level",
                    ],
                },
            },
        },
        "required": ["knowledge_units"],
    },
}
