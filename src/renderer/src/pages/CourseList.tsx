import { useState } from "react";
import { Link } from "react-router-dom";

import { useCourses, useCreateCourse, useDeleteCourse } from "../lib/api";
import { Button, Card, ErrorText, Input, Label, Spinner } from "../components/ui";

export default function CourseList() {
  const courses = useCourses();
  const createCourse = useCreateCourse();
  const deleteCourse = useDeleteCourse();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");

  function reset() {
    setTitle("");
    setExamDate("");
    setShowForm(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await createCourse.mutateAsync({
      title: title.trim(),
      exam_date: examDate || null,
    });
    reset();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Courses</h1>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>+ New course</Button>
        )}
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
                placeholder="e.g. Security+ V7"
              />
            </div>
            <div>
              <Label>Exam date (optional)</Label>
              <Input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={createCourse.isPending}>
                {createCourse.isPending ? "Creating…" : "Create"}
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                Cancel
              </Button>
            </div>
            {createCourse.error && (
              <ErrorText>{(createCourse.error as Error).message}</ErrorText>
            )}
          </form>
        </Card>
      )}

      {courses.isLoading && <Spinner />}
      {courses.error && (
        <ErrorText>{(courses.error as Error).message}</ErrorText>
      )}
      {courses.data && courses.data.length === 0 && !showForm && (
        <Card>
          <div className="text-slate-400 text-sm">
            No courses yet. Click <span className="text-slate-100">+ New course</span>{" "}
            to get started.
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courses.data?.map((c) => (
          <Card key={c.id} className="flex items-start justify-between gap-4">
            <Link
              to={`/courses/${c.id}`}
              className="flex-1 min-w-0 hover:text-emerald-300"
            >
              <div className="font-medium truncate">{c.title}</div>
              <div className="mt-1 text-xs text-slate-400 flex flex-wrap gap-x-3">
                <span>{c.sections_count} sections</span>
                {c.exam_date && <span>exam: {c.exam_date}</span>}
                <span>priority {c.priority_weight}</span>
              </div>
            </Link>
            <Button
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete "${c.title}" and all its data?`)) {
                  deleteCourse.mutate(c.id);
                }
              }}
              title="Delete course"
            >
              ✕
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
