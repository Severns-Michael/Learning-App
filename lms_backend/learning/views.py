from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ai.services import generate_study_items
from learning.models import KnowledgeUnit, StudyItem
from learning.serializers import KnowledgeUnitSerializer, StudyItemSerializer


def _item_dict_to_fields(item: dict, ku: KnowledgeUnit) -> dict:
    """Map a Claude-returned item dict to StudyItem constructor kwargs.

    Shape of `expected_answer` and `distractors` is mode-specific — see the
    docstring on StudyItem.
    """
    mode = item.get("mode", "")
    base = {
        "knowledge_unit": ku,
        "mode": mode,
        "prompt": item.get("prompt", ""),
        "blooms_level": item.get("blooms_level", "understand"),
        "distractors": [],
    }
    if mode == "flashcard":
        base["expected_answer"] = {
            "answer": item.get("answer", ""),
            "explanation": item.get("explanation", ""),
        }
    elif mode == "mc":
        base["expected_answer"] = {
            "answer": item.get("answer", ""),
            "explanation": item.get("explanation", ""),
        }
        base["distractors"] = item.get("distractors") or []
    elif mode == "scenario":
        base["expected_answer"] = {
            "answer": item.get("answer", ""),
            "rationale": item.get("rationale", ""),
            "expected_concepts": item.get("expected_concepts") or [],
        }
    elif mode == "fill_blank":
        # Stored identically to MC: prompt has a blank, but options + answer
        # are still presented as multiple choice in review.
        base["expected_answer"] = {
            "answer": item.get("answer", ""),
            "explanation": item.get("explanation", ""),
        }
        base["distractors"] = item.get("distractors") or []
    elif mode == "matching":
        base["expected_answer"] = {
            "pairs": item.get("pairs") or [],
            "explanation": item.get("explanation", ""),
        }
    elif mode == "free_response":
        base["expected_answer"] = {
            "model_answer": item.get("model_answer") or item.get("answer", ""),
            "expected_concepts": item.get("expected_concepts") or [],
        }
    return base


class KnowledgeUnitViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Knowledge units are created via the ingest endpoint, not direct POST.

    Supports PATCH for editing concept_summary, key_terms, connection_tags, etc.
    """

    queryset = KnowledgeUnit.objects.all()
    serializer_class = KnowledgeUnitSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        section_id = self.request.query_params.get("section")
        if section_id:
            qs = qs.filter(section_id=section_id)
        course_id = self.request.query_params.get("course")
        if course_id:
            qs = qs.filter(section__course_id=course_id)
        return qs

    @action(detail=True, methods=["post"], url_path="generate_items")
    def generate_items(self, request, pk=None):
        ku = self.get_object()
        # Build a matching-pool from the rest of the section's key terms.
        section_terms = []
        for other in ku.section.knowledge_units.exclude(pk=ku.pk):
            for kt in (other.key_terms or []):
                section_terms.append(kt)
        try:
            generated = generate_study_items(
                concept_summary=ku.concept_summary,
                key_terms=ku.key_terms or [],
                blooms_level=ku.blooms_level,
                connection_tags=ku.connection_tags or [],
                common_misconceptions=ku.common_misconceptions or [],
                source_text=ku.source_text,
                section_terms=section_terms,
            )
        except Exception as exc:
            return Response(
                {"detail": f"AI generation failed: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Replace existing items (regenerate semantics).
        StudyItem.objects.filter(knowledge_unit=ku).delete()

        created = [
            StudyItem.objects.create(**_item_dict_to_fields(item, ku))
            for item in generated
            if item.get("mode") and item.get("prompt")
        ]

        return Response(
            {"created": StudyItemSerializer(created, many=True).data},
            status=status.HTTP_201_CREATED,
        )


class StudyItemViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Study items are created via generate endpoints. PATCH allowed for edits."""

    queryset = StudyItem.objects.all()
    serializer_class = StudyItemSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        ku_id = self.request.query_params.get("knowledge_unit")
        if ku_id:
            qs = qs.filter(knowledge_unit_id=ku_id)
        section_id = self.request.query_params.get("section")
        if section_id:
            qs = qs.filter(knowledge_unit__section_id=section_id)
        # Multi-section filter: ?sections=1,2,3
        sections_csv = self.request.query_params.get("sections")
        if sections_csv:
            ids = [int(x) for x in sections_csv.split(",") if x.strip().isdigit()]
            if ids:
                qs = qs.filter(knowledge_unit__section_id__in=ids)
        course_id = self.request.query_params.get("course")
        if course_id:
            qs = qs.filter(knowledge_unit__section__course_id=course_id)
        mode = self.request.query_params.get("mode")
        if mode:
            qs = qs.filter(mode=mode)
        return qs
