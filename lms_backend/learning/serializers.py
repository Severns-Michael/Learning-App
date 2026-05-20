from rest_framework import serializers

from learning.models import KnowledgeUnit


class KnowledgeUnitSerializer(serializers.ModelSerializer):
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
            "created_at",
        )
        read_only_fields = ("created_at",)
