from rest_framework import mixins, viewsets

from learning.models import KnowledgeUnit
from learning.serializers import KnowledgeUnitSerializer


class KnowledgeUnitViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Knowledge units are created via the ingest endpoint, not direct POST."""

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
