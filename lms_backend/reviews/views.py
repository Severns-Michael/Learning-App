from django.utils import timezone
from rest_framework import mixins, viewsets

from learning.models import StudyItem
from reviews.models import ReviewLog
from reviews.serializers import ReviewLogSerializer


class ReviewLogViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    queryset = ReviewLog.objects.all()
    serializer_class = ReviewLogSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        item_id = self.request.query_params.get("study_item")
        if item_id:
            qs = qs.filter(study_item_id=item_id)
        return qs

    def perform_create(self, serializer):
        log = serializer.save()
        # Touch the StudyItem's last_reviewed_at so the dashboard can show staleness.
        StudyItem.objects.filter(pk=log.study_item_id).update(
            last_reviewed_at=timezone.now()
        )
