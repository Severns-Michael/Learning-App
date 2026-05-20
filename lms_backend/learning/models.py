from django.db import models


class BloomLevel(models.TextChoices):
    REMEMBER = "remember", "Remember"
    UNDERSTAND = "understand", "Understand"
    APPLY = "apply", "Apply"
    ANALYZE = "analyze", "Analyze"
    EVALUATE = "evaluate", "Evaluate"
    CREATE = "create", "Create"


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
