from django.urls import include, path
from rest_framework.routers import DefaultRouter

from api.views import health
from courses.views import CourseViewSet, SectionViewSet
from learning.views import KnowledgeUnitViewSet

router = DefaultRouter()
router.register(r"courses", CourseViewSet)
router.register(r"sections", SectionViewSet)
router.register(r"knowledge-units", KnowledgeUnitViewSet)

urlpatterns = [
    path("health/", health, name="health"),
    path("", include(router.urls)),
]
