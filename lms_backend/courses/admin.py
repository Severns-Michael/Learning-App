from django.contrib import admin

from courses.models import Course, Section


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("title", "exam_date", "priority_weight", "created_at")
    search_fields = ("title",)


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("title", "course", "order", "difficulty")
    list_filter = ("course",)
    search_fields = ("title",)
