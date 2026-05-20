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
