from django.contrib import admin

from learning.models import KnowledgeUnit


@admin.register(KnowledgeUnit)
class KnowledgeUnitAdmin(admin.ModelAdmin):
    list_display = ("__str__", "section", "blooms_level", "created_at")
    list_filter = ("blooms_level", "section__course")
    search_fields = ("concept_summary", "source_text")
