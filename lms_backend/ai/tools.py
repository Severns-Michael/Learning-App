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
        "Save a list of atomic knowledge units extracted from study notes. "
        "Always call this tool — do not reply in prose."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "knowledge_units": {
                "type": "array",
                "description": "Knowledge units extracted from the notes.",
                "items": {
                    "type": "object",
                    "properties": {
                        "concept_summary": {
                            "type": "string",
                            "description": (
                                "One- or two-sentence self-contained statement of the concept."
                            ),
                        },
                        "source_chunk": {
                            "type": "string",
                            "description": (
                                "The slice of the original notes this unit came from."
                            ),
                        },
                        "key_terms": {
                            "type": "array",
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
                            "items": {"type": "string"},
                        },
                        "common_misconceptions": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                    },
                    "required": ["concept_summary", "blooms_level"],
                },
            },
        },
        "required": ["knowledge_units"],
    },
}
