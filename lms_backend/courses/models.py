from django.db import models


class Course(models.Model):
    title = models.CharField(max_length=200)
    exam_date = models.DateField(null=True, blank=True)
    daily_minutes_goal = models.PositiveIntegerField(null=True, blank=True)
    mastery_threshold = models.PositiveSmallIntegerField(default=80)
    priority_weight = models.PositiveSmallIntegerField(default=3)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title


class Section(models.Model):
    course = models.ForeignKey(
        Course,
        related_name="sections",
        on_delete=models.CASCADE,
    )
    parent = models.ForeignKey(
        "self",
        related_name="children",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=0)
    difficulty = models.PositiveSmallIntegerField(default=3)
    estimated_mastery_min = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["course_id", "order", "id"]

    def __str__(self) -> str:
        return f"{self.course.title} / {self.title}"
