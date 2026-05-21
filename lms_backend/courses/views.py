from concurrent.futures import ThreadPoolExecutor, as_completed

from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ai.services import enhance_notes as enhance_notes_service
from ai.services import extract_concepts, generate_study_items
from courses.models import Course, Section
from courses.serializers import CourseSerializer, SectionSerializer
from learning.mastery import (
    compute_course_stats,
    compute_section_stats,
    mode_distribution,
    reviews_today_count,
    weakest_sections,
)
from learning.models import KnowledgeUnit, StudyItem
from learning.serializers import KnowledgeUnitSerializer
from learning.views import _item_dict_to_fields


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer

    @action(detail=True, methods=["get"], url_path="stats")
    def stats(self, request, pk=None):
        course = self.get_object()
        sections = course.sections.prefetch_related(
            "knowledge_units__study_items__review_logs"
        )
        section_stats = [
            {"id": s.id, "title": s.title, "order": s.order, **compute_section_stats(s)}
            for s in sections
        ]
        return Response(
            {
                "course": CourseSerializer(course).data,
                "overall": compute_course_stats(course),
                "sections": section_stats,
                "weakest_sections": weakest_sections(course, limit=3),
                "mode_distribution_7d": mode_distribution(course=course, days=7),
                "reviews_today": reviews_today_count(course=course),
            }
        )


class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.all()
    serializer_class = SectionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        course_id = self.request.query_params.get("course")
        if course_id:
            qs = qs.filter(course_id=course_id)
        return qs

    @action(detail=True, methods=["post"], url_path="enhance_notes")
    def enhance_notes(self, request, pk=None):
        """Send notes to Claude for improvement. Returns original + enhanced
        so the frontend can show a diff. Does NOT modify the section.

        Body: { text?: string, mode?: "polish" | "expand" }
          mode="polish" (default) — fix spelling/grammar only.
          mode="expand" — fill in missing detail for stubby notes.
        """
        section = self.get_object()
        text = (request.data.get("text") or section.notes or "").strip()
        mode = request.data.get("mode") or "polish"
        if mode not in ("polish", "expand"):
            return Response(
                {"detail": "mode must be 'polish' or 'expand'"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not text:
            return Response(
                {"detail": "no text to enhance"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            enhanced = enhance_notes_service(raw=text, mode=mode)
        except Exception as exc:
            return Response(
                {"detail": f"Enhancement failed: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"original": text, "enhanced": enhanced, "mode": mode})

    @action(detail=True, methods=["post"], url_path="ingest_notes")
    def ingest_notes(self, request, pk=None):
        """Ingest notes into knowledge units.

        If `text` is provided in the request body, write it to section.notes
        and ingest from it. Otherwise ingest from the existing section.notes.

        If `replace=true`, delete all existing KUs (and their items) first.
        """
        section = self.get_object()
        text = (request.data.get("text") or "").strip()
        replace = bool(request.data.get("replace"))

        if text:
            section.notes = text
            section.save(update_fields=["notes"])

        source = section.notes.strip()
        if not source:
            return Response(
                {"detail": "Section has no notes to ingest. Add notes first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            extracted = extract_concepts(
                notes=source, section_title=section.title
            )
        except Exception as exc:
            return Response(
                {"detail": f"AI extraction failed: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if replace:
            section.knowledge_units.all().delete()

        created = [
            KnowledgeUnit.objects.create(
                section=section,
                source_text=ku.get("source_chunk", "") or "",
                concept_summary=ku["concept_summary"],
                key_terms=ku.get("key_terms", []) or [],
                blooms_level=ku.get("blooms_level", "understand"),
                connection_tags=ku.get("connection_tags", []) or [],
                common_misconceptions=ku.get("common_misconceptions", []) or [],
            )
            for ku in extracted
        ]

        return Response(
            {"created": KnowledgeUnitSerializer(created, many=True).data},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="generate_items")
    def generate_items(self, request, pk=None):
        """Generate study items for every KU in this section, concurrently.

        Skips KUs that already have items unless `regenerate=true` is passed.
        Returns counts and any per-KU errors.
        """
        section = self.get_object()
        regenerate = bool(request.data.get("regenerate"))

        all_kus = list(
            section.knowledge_units.annotate(_item_count=Count("study_items"))
        )
        if regenerate:
            targets = all_kus
        else:
            targets = [ku for ku in all_kus if ku._item_count == 0]
        skipped_count = len(all_kus) - len(targets)

        if not targets:
            return Response(
                {
                    "generated": 0,
                    "skipped": skipped_count,
                    "errors": [],
                    "message": "No KUs needed generation.",
                }
            )

        # Build a matching-pool from all key terms across the section.
        all_section_terms = []
        for any_ku in all_kus:
            for kt in (any_ku.key_terms or []):
                all_section_terms.append(kt)

        def _work(ku: KnowledgeUnit):
            try:
                # Exclude this KU's own terms from the matching pool so Claude
                # pulls from siblings.
                own = ku.key_terms or []
                others = [kt for kt in all_section_terms if kt not in own]
                items = generate_study_items(
                    concept_summary=ku.concept_summary,
                    key_terms=own,
                    blooms_level=ku.blooms_level,
                    connection_tags=ku.connection_tags or [],
                    common_misconceptions=ku.common_misconceptions or [],
                    source_text=ku.source_text,
                    section_terms=others,
                )
                return ku, items, None
            except Exception as exc:
                return ku, None, str(exc)

        generated_ids: list[int] = []
        errors: list[dict] = []
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(_work, ku) for ku in targets]
            for future in as_completed(futures):
                ku, items, err = future.result()
                if err:
                    errors.append({"ku_id": ku.id, "message": err})
                    continue
                StudyItem.objects.filter(knowledge_unit=ku).delete()
                for item in items or []:
                    if item.get("mode") and item.get("prompt"):
                        StudyItem.objects.create(**_item_dict_to_fields(item, ku))
                generated_ids.append(ku.id)

        return Response(
            {
                "generated": len(generated_ids),
                "generated_ku_ids": generated_ids,
                "skipped": skipped_count,
                "errors": errors,
            }
        )
