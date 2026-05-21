import { useState } from "react";
import { Link } from "react-router-dom";

import { useCreateCourse, useDashboard, useDeleteCourse } from "../lib/api";
import type { DashboardCourse } from "../lib/types";
import { Button, Card, ErrorText, Input, Label, Spinner } from "../components/ui";
import { MasteryProgressBar, StatTile } from "../components/stats";

export default function CourseList() {
  const dash = useDashboard();
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

  const totalMastered = dash.data?.courses.reduce(
    (s, c) => s + c.stats.mastered_kus,
    0,
  );
  const totalReviews = dash.data?.courses.reduce(
    (s, c) => s + c.stats.total_reviews,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>+ New course</Button>
        )}
      </div>

      {/* Global stats */}
      {dash.data && (dash.data.courses.length > 0 || dash.data.reviews_today > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatTile label="Courses" value={dash.data.courses.length} />
          <StatTile
            label="Reviews today"
            value={dash.data.reviews_today}
            accent={dash.data.reviews_today > 0 ? "good" : "default"}
          />
          <StatTile
            label="Total reviews"
            value={totalReviews ?? 0}
            sub={
              (totalMastered ?? 0) > 0 ? `${totalMastered} KUs mastered` : undefined
            }
          />
        </div>
      )}

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

      {dash.isLoading && <Spinner />}
      {dash.error && <ErrorText>{(dash.error as Error).message}</ErrorText>}
      {dash.data && dash.data.courses.length === 0 && !showForm && (
        <Card>
          <div className="text-slate-400 text-sm">
            No courses yet. Click <span className="text-slate-100">+ New course</span>{" "}
            to get started.
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dash.data?.courses.map((c) => (
          <CourseCard
            key={c.id}
            course={c}
            onDelete={() => deleteCourse.mutate(c.id)}
          />
        ))}
      </div>
    </div>
  );
}

function CourseCard({
  course,
  onDelete,
}: {
  course: DashboardCourse;
  onDelete: () => void;
}) {
  const { stats } = course;
  return (
    <Card className="flex items-start justify-between gap-4">
      <Link
        to={`/courses/${course.id}`}
        className="flex-1 min-w-0 space-y-2 hover:text-emerald-300"
      >
        <div className="font-medium truncate">{course.title}</div>
        <div className="text-xs text-slate-400 flex flex-wrap gap-x-3">
          <span>{course.sections_count} sections</span>
          <span>{stats.total_kus} KUs</span>
          {course.exam_date && <span>exam: {course.exam_date}</span>}
        </div>
        {stats.total_kus > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Mastery</span>
              <span className="text-slate-200">
                {stats.mastered_kus} / {stats.total_kus} · {stats.mastery_pct}%
              </span>
            </div>
            <MasteryProgressBar pct={stats.mastery_pct} />
          </div>
        )}
        {stats.total_reviews > 0 && (
          <div className="text-xs text-slate-400">
            {stats.total_reviews} reviews · {stats.accuracy_pct}% accuracy
          </div>
        )}
      </Link>
      <Button
        variant="ghost"
        onClick={(e) => {
          e.preventDefault();
          if (confirm(`Delete "${course.title}" and all its data?`)) onDelete();
        }}
        title="Delete course"
      >
        ✕
      </Button>
    </Card>
  );
}
