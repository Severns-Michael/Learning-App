import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  useCourseStats,
  useCourseStudyItems,
  useCreateSection,
  useDeleteSection,
  useSections,
} from "../lib/api";
import type { SectionStatsRow } from "../lib/types";
import { Button, Card, ErrorText, Input, Label, Spinner } from "../components/ui";
import { MasteryProgressBar, ModeBar, StatTile } from "../components/stats";

export default function CourseDetail() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const id = courseId ? Number(courseId) : undefined;

  const stats = useCourseStats(id);
  const sections = useSections(id); // for create-section invalidation flow
  const courseItems = useCourseStudyItems(id);
  const createSection = useCreateSection();
  const deleteSection = useDeleteSection();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [order, setOrder] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  function toggleSelected(sectionId: number) {
    setSelectedIds((prev) =>
      prev.includes(sectionId)
        ? prev.filter((x) => x !== sectionId)
        : [...prev, sectionId],
    );
  }

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
      : (stats.data?.sections.length ?? sections.data?.length ?? 0) + 1;
    await createSection.mutateAsync({
      course: id,
      title: title.trim(),
      order: nextOrder,
    });
    reset();
  }

  if (stats.isLoading) return <Spinner />;
  if (stats.error)
    return <ErrorText>{(stats.error as Error).message}</ErrorText>;
  if (!stats.data) return null;

  const course = stats.data.course;
  const overall = stats.data.overall;
  const totalStudyItems = courseItems.data?.length ?? 0;
  const weakestIds = new Set(stats.data.weakest_sections.map((s) => s.id));

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-100">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{course.title}</h1>
        <div className="mt-1 text-xs text-slate-400 flex flex-wrap gap-x-3">
          {course.exam_date && <span>exam: {course.exam_date}</span>}
          <span>priority {course.priority_weight}</span>
          <span>{course.sections_count} sections</span>
        </div>
      </div>

      {/* Stats panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="Mastery"
          value={`${overall.mastery_pct}%`}
          sub={`${overall.mastered_kus} / ${overall.total_kus} KUs`}
          accent={
            overall.mastery_pct >= 80
              ? "good"
              : overall.mastery_pct >= 50
                ? "warn"
                : overall.total_reviews > 0
                  ? "bad"
                  : "default"
          }
        />
        <StatTile
          label="Accuracy"
          value={overall.total_reviews > 0 ? `${overall.accuracy_pct}%` : "—"}
          sub={`${overall.total_reviews} reviews`}
          accent={
            overall.total_reviews === 0
              ? "default"
              : overall.accuracy_pct >= 80
                ? "good"
                : overall.accuracy_pct >= 60
                  ? "warn"
                  : "bad"
          }
        />
        <StatTile
          label="Reviewed KUs"
          value={`${overall.reviewed_kus} / ${overall.total_kus}`}
        />
        <StatTile
          label="Reviews today"
          value={stats.data.reviews_today}
          accent={stats.data.reviews_today > 0 ? "good" : "default"}
        />
      </div>

      {stats.data.mode_distribution_7d.length > 0 && (
        <Card>
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
            Mode mix (last 7 days)
          </div>
          <ModeBar distribution={stats.data.mode_distribution_7d} />
        </Card>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-medium">Sections</h2>
        <div className="flex gap-2">
          {selectedIds.length > 0 ? (
            <Button
              onClick={() =>
                navigate(
                  `/courses/${id}/review?sections=${selectedIds.join(",")}`,
                )
              }
              title={`Review items across ${selectedIds.length} selected sections`}
            >
              ▶ Review selected ({selectedIds.length})
            </Button>
          ) : (
            totalStudyItems > 0 && (
              <Button
                onClick={() => navigate(`/courses/${id}/review`)}
                title={`Review ${totalStudyItems} items across the whole course`}
              >
                ▶ Review course ({totalStudyItems})
              </Button>
            )
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

      {stats.data.sections.length === 0 && !showForm && (
        <Card>
          <div className="text-slate-400 text-sm">
            No sections yet. Add the first one to start organizing notes.
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {stats.data.sections.map((s) => (
          <SectionRow
            key={s.id}
            section={s}
            courseId={course.id}
            isWeakest={weakestIds.has(s.id)}
            selected={selectedIds.includes(s.id)}
            onToggleSelected={() => toggleSelected(s.id)}
            onDelete={() => {
              if (confirm(`Delete "${s.title}" and all its data?`)) {
                deleteSection.mutate(s.id);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SectionRow({
  section,
  courseId,
  isWeakest,
  selected,
  onToggleSelected,
  onDelete,
}: {
  section: SectionStatsRow;
  courseId: number;
  isWeakest: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const hasItems = section.total_items > 0;
  return (
    <Card
      className={`flex items-center gap-3 py-3 ${
        isWeakest ? "ring-1 ring-rose-800/60" : ""
      } ${selected ? "ring-1 ring-emerald-700/60 bg-emerald-950/10" : ""}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelected}
        title="Select for combined review"
        className="h-4 w-4 accent-emerald-600 cursor-pointer"
      />
      <Link
        to={`/courses/${courseId}/sections/${section.id}`}
        className="flex-1 min-w-0 hover:text-emerald-300 space-y-1"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 w-6">{section.order}</span>
          <span className="font-medium truncate">{section.title}</span>
          {isWeakest && (
            <span className="text-xs text-rose-300">weakest</span>
          )}
        </div>
        <div className="ml-9 flex flex-wrap gap-x-3 text-xs text-slate-400">
          <span>
            {section.mastered_kus} / {section.total_kus} mastered
          </span>
          {section.total_reviews > 0 && (
            <span>{section.accuracy_pct}% accuracy</span>
          )}
          <span>{section.total_items} cards</span>
        </div>
        {section.total_kus > 0 && (
          <div className="ml-9 mr-4">
            <MasteryProgressBar pct={section.mastery_pct} />
          </div>
        )}
      </Link>
      <Button
        variant="secondary"
        disabled={!hasItems}
        onClick={(e) => {
          e.preventDefault();
          navigate(`/courses/${courseId}/sections/${section.id}/review`);
        }}
        title={hasItems ? "Review this section" : "No cards yet"}
        className="!px-2 !py-1 text-xs"
      >
        ▶ Review
      </Button>
      <Button
        variant="ghost"
        onClick={onDelete}
        title="Delete section"
        className="!px-2 !py-1"
      >
        ✕
      </Button>
    </Card>
  );
}
