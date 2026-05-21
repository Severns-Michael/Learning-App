"""Mastery / accuracy computation for the dashboard.

V1 formula (no scheduler dependency):
- A KU is `mastered` if:
    1. It has been reviewed in BOTH of its modes (flashcard + MC), AND
    2. The last 5 reviews across all items in the KU have >= 80% accuracy
       (require >= 3 reviews to have happened to count as mastered)
- `accuracy_pct` = correct / total reviews over the last 5 per item, averaged.
- `mastery_pct` = mastered_kus / total_kus (in scope).

Computed on request — no MasteryStats cache. Cheap for typical workloads.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import asdict, dataclass
from datetime import timedelta
from typing import Iterable

from django.utils import timezone

from courses.models import Course, Section
from learning.models import KnowledgeUnit
from reviews.models import ReviewLog

ACCURACY_THRESHOLD = 0.80
MIN_REVIEWS_FOR_MASTERY = 3
RECENT_REVIEWS_WINDOW = 5


@dataclass
class ScopeStats:
    total_kus: int
    reviewed_kus: int
    mastered_kus: int
    mastery_pct: int
    accuracy_pct: int
    total_items: int
    items_reviewed: int
    total_reviews: int
    last_reviewed_at: str | None

    def to_dict(self) -> dict:
        return asdict(self)


def _stats_for_kus(kus: Iterable[KnowledgeUnit]) -> ScopeStats:
    """Compute stats over an iterable of KUs (with prefetched items+logs)."""
    kus = list(kus)
    total_kus = len(kus)
    if total_kus == 0:
        return ScopeStats(0, 0, 0, 0, 0, 0, 0, 0, None)

    mastered = 0
    reviewed_kus = 0
    total_items = 0
    items_reviewed = 0
    total_reviews = 0
    overall_correct = 0
    overall_total = 0
    last_review = None

    for ku in kus:
        ku_logs = []
        modes_with_reviews: set[str] = set()
        for item in ku.study_items.all():
            total_items += 1
            item_logs = sorted(
                item.review_logs.all(), key=lambda l: l.reviewed_at, reverse=True
            )
            if item_logs:
                items_reviewed += 1
                modes_with_reviews.add(item.mode)
                recent = item_logs[:RECENT_REVIEWS_WINDOW]
                overall_correct += sum(1 for l in recent if l.was_correct)
                overall_total += len(recent)
                total_reviews += len(item_logs)
                ku_logs.extend(recent)
                if last_review is None or item_logs[0].reviewed_at > last_review:
                    last_review = item_logs[0].reviewed_at

        if ku_logs:
            reviewed_kus += 1
            correct = sum(1 for l in ku_logs if l.was_correct)
            ratio = correct / len(ku_logs)
            if (
                len(ku_logs) >= MIN_REVIEWS_FOR_MASTERY
                and ratio >= ACCURACY_THRESHOLD
            ):
                mastered += 1

    return ScopeStats(
        total_kus=total_kus,
        reviewed_kus=reviewed_kus,
        mastered_kus=mastered,
        mastery_pct=round((mastered / total_kus) * 100) if total_kus else 0,
        accuracy_pct=round((overall_correct / overall_total) * 100)
        if overall_total
        else 0,
        total_items=total_items,
        items_reviewed=items_reviewed,
        total_reviews=total_reviews,
        last_reviewed_at=last_review.isoformat() if last_review else None,
    )


def compute_section_stats(section: Section) -> dict:
    kus = section.knowledge_units.prefetch_related("study_items__review_logs")
    return _stats_for_kus(kus).to_dict()


def compute_course_stats(course: Course) -> dict:
    kus = KnowledgeUnit.objects.filter(section__course=course).prefetch_related(
        "study_items__review_logs"
    )
    return _stats_for_kus(kus).to_dict()


def mode_distribution(course: Course | None = None, days: int = 7) -> list[dict]:
    """Count of reviews by mode in the last `days` days."""
    cutoff = timezone.now() - timedelta(days=days)
    qs = ReviewLog.objects.filter(reviewed_at__gte=cutoff)
    if course:
        qs = qs.filter(study_item__knowledge_unit__section__course=course)
    rows = qs.values_list("study_item__mode", flat=True)
    counts = Counter(rows)
    total = sum(counts.values())
    return [
        {
            "mode": mode,
            "count": count,
            "pct": round((count / total) * 100) if total else 0,
        }
        for mode, count in counts.most_common()
    ]


def weakest_sections(course: Course, limit: int = 3) -> list[dict]:
    """Return up to `limit` sections sorted by lowest accuracy (must have >=1 review)."""
    sections = course.sections.prefetch_related(
        "knowledge_units__study_items__review_logs"
    )
    rows = []
    for section in sections:
        stats = compute_section_stats(section)
        if stats["total_reviews"] > 0:
            rows.append({"id": section.id, "title": section.title, **stats})
    rows.sort(key=lambda r: (r["accuracy_pct"], -r["total_reviews"]))
    return rows[:limit]


def reviews_today_count(course: Course | None = None) -> int:
    """Number of ReviewLogs created since local midnight."""
    today = timezone.now().date()
    qs = ReviewLog.objects.filter(reviewed_at__date=today)
    if course:
        qs = qs.filter(study_item__knowledge_unit__section__course=course)
    return qs.count()
