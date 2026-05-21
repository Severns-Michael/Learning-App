from django.db import models


class BloomLevel(models.TextChoices):
    REMEMBER = "remember", "Remember"
    UNDERSTAND = "understand", "Understand"
    APPLY = "apply", "Apply"
    ANALYZE = "analyze", "Analyze"
    EVALUATE = "evaluate", "Evaluate"
    CREATE = "create", "Create"


class StudyMode(models.TextChoices):
    FLASHCARD = "flashcard", "Flashcard"
    MC = "mc", "Multiple choice"
    SCENARIO = "scenario", "Scenario"
    FILL_BLANK = "fill_blank", "Fill in the blank"
    FREE_RESPONSE = "free_response", "Free response"
    MATCHING = "matching", "Matching"


class KnowledgeUnit(models.Model):
    section = models.ForeignKey(
        "courses.Section",
        related_name="knowledge_units",
        on_delete=models.CASCADE,
    )
    source_text = models.TextField(
        blank=True,
        help_text="The original chunk of notes this KU was derived from.",
    )
    concept_summary = models.TextField(
        help_text="One- to two-sentence summary of the concept this KU teaches.",
    )
    key_terms = models.JSONField(
        default=list,
        blank=True,
        help_text="List of key terms / definitions for this concept.",
    )
    blooms_level = models.CharField(
        max_length=20,
        choices=BloomLevel.choices,
        default=BloomLevel.UNDERSTAND,
    )
    connection_tags = models.JSONField(
        default=list,
        blank=True,
        help_text="Concept tags / topics this KU connects to.",
    )
    common_misconceptions = models.JSONField(
        default=list,
        blank=True,
        help_text="Common misconceptions the AI flagged for this concept.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["section_id", "id"]

    def __str__(self) -> str:
        return self.concept_summary[:80]


class StudyItem(models.Model):
    """A single retrieval prompt derived from a KnowledgeUnit, in one of 5 modes.

    `expected_answer` and `distractors` are JSON because their shape varies by mode:
      flashcard:    expected_answer = {"answer": str, "explanation": str?}
                    distractors    = []
      mc:           expected_answer = {"answer": str, "explanation": str}
                    distractors    = [{"text": str, "why_wrong": str}, ...]  # 3 entries
      scenario:     expected_answer = {"answer": str, "rationale": str,
                                       "expected_concepts": [str, ...]}
                    distractors    = []
      fill_blank:   expected_answer = {"acceptable_answers": [str, ...], "explanation": str?}
                    distractors    = []
      free_response: expected_answer = {"model_answer": str,
                                        "expected_concepts": [str, ...]}
                    distractors    = []
    """

    knowledge_unit = models.ForeignKey(
        KnowledgeUnit,
        related_name="study_items",
        on_delete=models.CASCADE,
    )
    mode = models.CharField(max_length=20, choices=StudyMode.choices)
    prompt = models.TextField()
    expected_answer = models.JSONField(default=dict)
    distractors = models.JSONField(default=list, blank=True)
    blooms_level = models.CharField(
        max_length=20,
        choices=BloomLevel.choices,
        default=BloomLevel.UNDERSTAND,
    )
    last_reviewed_at = models.DateTimeField(null=True, blank=True)

    # SM-2 scheduler fields. Defaults sit unused in V1; V2 scheduler will populate.
    ease_factor = models.FloatField(default=2.5)
    interval_days = models.PositiveIntegerField(default=0)
    next_review_at = models.DateTimeField(null=True, blank=True)
    repetitions = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["knowledge_unit_id", "mode", "id"]

    def __str__(self) -> str:
        return f"[{self.mode}] {self.prompt[:60]}"
