from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.response import Response


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
