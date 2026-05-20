from concurrent.futures import ThreadPoolExecutor, as_completed

from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ai.services import extract_concepts, generate_study_items
from courses.models import Course, Section
from courses.serializers import CourseSerializer, SectionSerializer
from learning.models import KnowledgeUnit, StudyItem
from learning.serializers import KnowledgeUnitSerializer
from learning.views import _item_dict_to_fields


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer


class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.all()
    serializer_class = SectionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        course_id = self.request.query_params.get("course")
        if course_id:
            qs = qs.filter(course_id=course_id)
        return qs

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

        def _work(ku: KnowledgeUnit):
            try:
                items = generate_study_items(
                    concept_summary=ku.concept_summary,
                    key_terms=ku.key_terms or [],
                    blooms_level=ku.blooms_level,
                    connection_tags=ku.connection_tags or [],
                    common_misconceptions=ku.common_misconceptions or [],
                    source_text=ku.source_text,
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
