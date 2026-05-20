from rest_framework import serializers

from courses.models import Course, Section


class SectionSerializer(serializers.ModelSerializer):
    knowledge_units_count = serializers.IntegerField(
        source="knowledge_units.count", read_only=True
    )

    class Meta:
        model = Section
        fields = (
            "id",
            "course",
            "parent",
            "title",
            "order",
            "difficulty",
            "estimated_mastery_min",
            "knowledge_units_count",
        )


class CourseSerializer(serializers.ModelSerializer):
    sections_count = serializers.IntegerField(source="sections.count", read_only=True)

    class Meta:
        model = Course
        fields = (
            "id",
            "title",
            "exam_date",
            "daily_minutes_goal",
            "mastery_threshold",
            "priority_weight",
            "sections_count",
            "created_at",
        )
        read_only_fields = ("created_at",)
