import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  useCourse,
  useCourseStudyItems,
  useCreateSection,
  useDeleteSection,
  useSections,
} from "../lib/api";
import { Button, Card, ErrorText, Input, Label, Spinner } from "../components/ui";

export default function CourseDetail() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const id = courseId ? Number(courseId) : undefined;
  const course = useCourse(id);
  const sections = useSections(id);
  const courseItems = useCourseStudyItems(id);
  const createSection = useCreateSection();
  const deleteSection = useDeleteSection();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [order, setOrder] = useState("");

  function reset() {
    setTitle("");
    setOrder("");
    setShowForm(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || id === undefined) return;
    const nextOrder = order
      ? Number(order)
      : (sections.data?.length ?? 0) + 1;
    await createSection.mutateAsync({
      course: id,
      title: title.trim(),
      order: nextOrder,
    });
    reset();
  }

  if (course.isLoading) return <Spinner />;
  if (course.error)
    return <ErrorText>{(course.error as Error).message}</ErrorText>;
  if (!course.data) return null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/"
          className="text-sm text-slate-400 hover:text-slate-100"
        >
          ← Courses
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{course.data.title}</h1>
        <div className="mt-1 text-xs text-slate-400 flex flex-wrap gap-x-3">
          {course.data.exam_date && <span>exam: {course.data.exam_date}</span>}
          <span>priority {course.data.priority_weight}</span>
          <span>{course.data.sections_count} sections</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-medium">Sections</h2>
        <div className="flex gap-2">
          {(courseItems.data?.length ?? 0) > 0 && (
            <Button
              onClick={() => navigate(`/courses/${id}/review`)}
              title={`Review ${courseItems.data?.length ?? 0} items across the whole course`}
            >
              ▶ Review course ({courseItems.data?.length ?? 0})
            </Button>
          )}
          {!showForm && (
            <Button variant="secondary" onClick={() => setShowForm(true)}>
              + New section
            </Button>
          )}
        </div>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 1.0 General Security Concepts"
              />
            </div>
            <div>
              <Label>Order (optional)</Label>
              <Input
                type="number"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                placeholder="auto"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={createSection.isPending}>
                {createSection.isPending ? "Creating…" : "Create"}
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                Cancel
              </Button>
            </div>
            {createSection.error && (
              <ErrorText>{(createSection.error as Error).message}</ErrorText>
            )}
          </form>
        </Card>
      )}

      {sections.isLoading && <Spinner />}
      {sections.data && sections.data.length === 0 && !showForm && (
        <Card>
          <div className="text-slate-400 text-sm">
            No sections yet. Add the first one to start organizing notes.
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {sections.data?.map((s) => (
          <Card
            key={s.id}
            className="flex items-center justify-between gap-4 py-3"
          >
            <Link
              to={`/courses/${course.data.id}/sections/${s.id}`}
              className="flex-1 min-w-0 hover:text-emerald-300"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-6">{s.order}</span>
                <span className="font-medium truncate">{s.title}</span>
              </div>
              <div className="mt-1 ml-9 text-xs text-slate-400">
                {s.knowledge_units_count} knowledge units
              </div>
            </Link>
            <Button
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete "${s.title}" and all its data?`)) {
                  deleteSection.mutate(s.id);
                }
              }}
              title="Delete section"
            >
              ✕
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
