from django.contrib import admin

from learning.models import KnowledgeUnit, StudyItem


@admin.register(KnowledgeUnit)
class KnowledgeUnitAdmin(admin.ModelAdmin):
    list_display = ("__str__", "section", "blooms_level", "created_at")
    list_filter = ("blooms_level", "section__course")
    search_fields = ("concept_summary", "source_text")


@admin.register(StudyItem)
class StudyItemAdmin(admin.ModelAdmin):
    list_display = ("__str__", "knowledge_unit", "mode", "blooms_level")
    list_filter = ("mode", "blooms_level", "knowledge_unit__section__course")
    search_fields = ("prompt",)
