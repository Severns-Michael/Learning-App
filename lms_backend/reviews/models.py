from django.db import models
from django.utils import timezone


class ReviewLog(models.Model):
    """One review of a StudyItem by the user."""

    study_item = models.ForeignKey(
        "learning.StudyItem",
        related_name="review_logs",
        on_delete=models.CASCADE,
    )
    reviewed_at = models.DateTimeField(default=timezone.now)
    was_correct = models.BooleanField()
    user_rating = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="0-5 self-rating (Anki-style). Optional in V1.",
    )
    response_time_ms = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-reviewed_at"]
        indexes = [
            models.Index(fields=["study_item", "-reviewed_at"]),
        ]

    def __str__(self) -> str:
        return f"{'✓' if self.was_correct else '✗'} item={self.study_item_id} @ {self.reviewed_at:%Y-%m-%d %H:%M}"
