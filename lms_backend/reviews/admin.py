from django.contrib import admin

from reviews.models import ReviewLog


@admin.register(ReviewLog)
class ReviewLogAdmin(admin.ModelAdmin):
    list_display = ("__str__", "study_item", "was_correct", "reviewed_at")
    list_filter = ("was_correct",)
    date_hierarchy = "reviewed_at"
