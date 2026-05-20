from rest_framework import serializers

from reviews.models import ReviewLog


class ReviewLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewLog
        fields = (
            "id",
            "study_item",
            "reviewed_at",
            "was_correct",
            "user_rating",
            "response_time_ms",
        )
        read_only_fields = ("reviewed_at",)
