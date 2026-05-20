from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ai.services import extract_concepts
from courses.models import Course, Section
from courses.serializers import CourseSerializer, SectionSerializer
from learning.models import KnowledgeUnit
from learning.serializers import KnowledgeUnitSerializer


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
        section = self.get_object()
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response(
                {"detail": "text is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            extracted = extract_concepts(notes=text, section_title=section.title)
        except Exception as exc:
            return Response(
                {"detail": f"AI extraction failed: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

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
