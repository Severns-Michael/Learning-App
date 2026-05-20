GENERATE_STUDY_ITEMS_TOOL = {
    "name": "generate_study_items",
    "description": (
        "Save the study items for one knowledge unit: exactly one flashcard and "
        "one multiple-choice item. Always call this tool — do not reply in prose."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "minItems": 2,
                "maxItems": 2,
                "items": {
                    "type": "object",
                    "properties": {
                        "mode": {
                            "type": "string",
                            "enum": ["flashcard", "mc"],
                        },
                        "prompt": {"type": "string"},
                        "answer": {
                            "type": "string",
                            "description": (
                                "The correct answer (string). Required for "
                                "flashcard, mc, scenario. Use acceptable_answers "
                                "for fill_blank and model_answer for free_response."
                            ),
                        },
                        "explanation": {
                            "type": "string",
                            "description": "Optional. Why the answer is what it is.",
                        },
                        "distractors": {
                            "type": "array",
                            "description": "Required when mode=mc. Exactly 3 items.",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "text": {"type": "string"},
                                    "why_wrong": {"type": "string"},
                                },
                                "required": ["text", "why_wrong"],
                            },
                        },
                        "rationale": {
                            "type": "string",
                            "description": "Required for mode=scenario.",
                        },
                        "expected_concepts": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": (
                                "Required for mode=scenario and mode=free_response."
                            ),
                        },
                        "acceptable_answers": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Required for mode=fill_blank.",
                        },
                        "model_answer": {
                            "type": "string",
                            "description": "Required for mode=free_response.",
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
