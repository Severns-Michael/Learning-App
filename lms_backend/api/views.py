from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.response import Response

from courses.models import Course
from courses.serializers import CourseSerializer
from learning.mastery import (
    compute_course_stats,
    mode_distribution,
    reviews_today_count,
)


@api_view(["GET"])
def health(_request):
    """Returns ok=True if the backend can reach Postgres."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        db_ok = True
    except Exception as exc:
        return Response({"ok": False, "db": False, "error": str(exc)}, status=503)
    return Response({"ok": True, "db": db_ok})


@api_view(["GET"])
def dashboard(_request):
    """Top-level dashboard: every course with summary stats + global totals."""
    courses_with_stats = []
    for course in Course.objects.all():
        courses_with_stats.append(
            {
                **CourseSerializer(course).data,
                "stats": compute_course_stats(course),
            }
        )
    return Response(
        {
            "courses": courses_with_stats,
            "reviews_today": reviews_today_count(),
            "mode_distribution_7d": mode_distribution(days=7),
        }
    )
