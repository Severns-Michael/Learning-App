from rest_framework import serializers

from learning.models import KnowledgeUnit, StudyItem


class StudyItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudyItem
        fields = (
            "id",
            "knowledge_unit",
            "mode",
            "prompt",
            "expected_answer",
            "distractors",
            "blooms_level",
            "last_reviewed_at",
            "created_at",
        )
        read_only_fields = ("created_at", "last_reviewed_at")


class KnowledgeUnitSerializer(serializers.ModelSerializer):
    study_items_count = serializers.IntegerField(
        source="study_items.count", read_only=True
    )

    class Meta:
        model = KnowledgeUnit
        fields = (
            "id",
            "section",
            "source_text",
            "concept_summary",
            "key_terms",
            "blooms_level",
            "connection_tags",
            "common_misconceptions",
            "study_items_count",
            "created_at",
        )
        read_only_fields = ("created_at",)
