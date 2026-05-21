import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import {
  useCourse,
  useCourseStudyItems,
  useCreateReviewLog,
  useMultiSectionStudyItems,
  useSection,
  useSectionStudyItems,
} from "../lib/api";
import type { Distractor, StudyItem } from "../lib/types";
import { Button, Card, ErrorText, Spinner } from "../components/ui";

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type ReviewResult = { item: StudyItem; was_correct: boolean };

export default function ReviewSession() {
  const { courseId, sectionId } = useParams();
  const [searchParams] = useSearchParams();
  const modeFilter = searchParams.get("mode"); // optional: ?mode=mc
  const sectionsParam = searchParams.get("sections"); // optional: ?sections=1,2,3

  const multiSectionIds: number[] = sectionsParam
    ? sectionsParam.split(",").map((s) => Number(s)).filter((n) => !Number.isNaN(n))
    : [];
  const isMultiSectionScope = multiSectionIds.length > 0;
  const isSectionScope = sectionId !== undefined;
  const courseIdNum = courseId ? Number(courseId) : undefined;
  const sectionIdNum = sectionId ? Number(sectionId) : undefined;

  const section = useSection(isSectionScope ? sectionIdNum : undefined);
  const course = useCourse(courseIdNum);
  const sectionItems = useSectionStudyItems(isSectionScope ? sectionIdNum : undefined);
  const courseItems = useCourseStudyItems(
    !isSectionScope && !isMultiSectionScope ? courseIdNum : undefined,
  );
  const multiItems = useMultiSectionStudyItems(
    isMultiSectionScope ? multiSectionIds : [],
  );
  const items = isSectionScope
    ? sectionItems
    : isMultiSectionScope
      ? multiItems
      : courseItems;

  const createLog = useCreateReviewLog();

  // Build the shuffled queue once when items load. Re-shuffle resets via key.
  const [reshuffleKey, setReshuffleKey] = useState(0);
  const queue = useMemo<StudyItem[]>(() => {
    if (!items.data) return [];
    let filtered = items.data;
    if (modeFilter) {
      filtered = filtered.filter((i) => i.mode === modeFilter);
    }
    return shuffle(filtered);
    // reshuffleKey is intentionally a dep so "Review again" reshuffles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.data, modeFilter, reshuffleKey]);

  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<ReviewResult[]>([]);

  useEffect(() => {
    setIndex(0);
    setResults([]);
  }, [reshuffleKey, queue.length]);

  if (items.isLoading || section.isLoading || course.isLoading) {
    return <Spinner />;
  }
  if (items.error) {
    return <ErrorText>{(items.error as Error).message}</ErrorText>;
  }

  const scopeTitle = isSectionScope
    ? (section.data?.title ?? "Section")
    : isMultiSectionScope
      ? `${course.data?.title ?? "Course"} — ${multiSectionIds.length} sections`
      : (course.data?.title ?? "Course");
  const backTo = isSectionScope
    ? `/courses/${courseId}/sections/${sectionId}`
    : `/courses/${courseId}`;

  if (queue.length === 0) {
    return (
      <div className="space-y-4">
        <Link
          to={backTo}
          className="text-sm text-slate-400 hover:text-slate-100"
        >
          ← {scopeTitle}
        </Link>
        <Card>
          <div className="text-slate-300 text-sm">
            No study items to review{modeFilter ? ` in mode "${modeFilter}"` : ""}.
            Generate items first.
          </div>
        </Card>
      </div>
    );
  }

  const done = index >= queue.length;

  function recordAndAdvance(item: StudyItem, wasCorrect: boolean) {
    setResults((r) => [...r, { item, was_correct: wasCorrect }]);
    createLog.mutate({ study_item: item.id, was_correct: wasCorrect });
    setIndex((i) => i + 1);
  }

  if (done) {
    const correct = results.filter((r) => r.was_correct).length;
    const accuracy = Math.round((correct / results.length) * 100);
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Link
          to={backTo}
          className="text-sm text-slate-400 hover:text-slate-100"
        >
          ← {scopeTitle}
        </Link>
        <Card className="text-center space-y-3 py-10">
          <div className="text-2xl font-semibold">Review complete</div>
          <div className="text-4xl font-bold text-emerald-300">
            {correct} / {results.length}
          </div>
          <div className="text-sm text-slate-400">{accuracy}% accuracy</div>
          <div className="flex justify-center gap-2 pt-4">
            <Button onClick={() => setReshuffleKey((k) => k + 1)}>
              Review again
            </Button>
            <Link to={backTo}>
              <Button variant="secondary">Done</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={backTo}
          className="text-sm text-slate-400 hover:text-slate-100"
        >
          ← {scopeTitle}
        </Link>
        <div className="text-xs text-slate-400">
          {modeFilter ? `mode: ${modeFilter}` : "all modes"}
        </div>
      </div>
      <ProgressBar current={index + 1} total={queue.length} />
      <ReviewItem
        key={queue[index].id}
        item={queue[index]}
        onResult={(wasCorrect) => recordAndAdvance(queue[index], wasCorrect)}
      />
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = (current / total) * 100;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>
          {current} / {total}
        </span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ----- Per-item review components -----

function ReviewItem({
  item,
  onResult,
}: {
  item: StudyItem;
  onResult: (wasCorrect: boolean) => void;
}) {
  // fill_blank is stored as MC (answer + distractors) and reviewed identically.
  if (item.mode === "mc" || item.mode === "fill_blank") {
    return <MCReview item={item} onResult={onResult} />;
  }
  if (item.mode === "matching") {
    return <MatchingReview item={item} onResult={onResult} />;
  }
  return <FlashcardReview item={item} onResult={onResult} />;
}

function FlashcardReview({
  item,
  onResult,
}: {
  item: StudyItem;
  onResult: (wasCorrect: boolean) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const ea = item.expected_answer as Record<string, unknown>;
  const answer = String(ea.answer ?? ea.model_answer ?? "");
  const explanation = String(ea.explanation ?? "");

  // Keyboard: Space to reveal/advance, 1 = wrong, 2 = right.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === " ") {
        e.preventDefault();
        if (!revealed) setRevealed(true);
      } else if (revealed && (e.key === "1" || e.key === "j")) {
        onResult(false);
      } else if (revealed && (e.key === "2" || e.key === "k")) {
        onResult(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, onResult]);

  return (
    <Card className="space-y-4 min-h-[300px] flex flex-col">
      <ModeBadge mode={item.mode} />
      <div className="text-lg leading-relaxed flex-1">{item.prompt}</div>
      {revealed ? (
        <div className="border-t border-slate-800 pt-4 space-y-2">
          <div className="text-emerald-300 text-lg">{answer}</div>
          {explanation && (
            <div className="text-sm text-slate-400">{explanation}</div>
          )}
          <div className="flex gap-2 pt-3">
            <Button
              variant="danger"
              onClick={() => onResult(false)}
              className="flex-1"
            >
              ✗ Didn't get it
              <span className="ml-2 text-xs opacity-60">[1]</span>
            </Button>
            <Button onClick={() => onResult(true)} className="flex-1">
              ✓ Got it
              <span className="ml-2 text-xs opacity-60">[2]</span>
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setRevealed(true)} className="self-start">
          Show answer
          <span className="ml-2 text-xs opacity-60">[space]</span>
        </Button>
      )}
    </Card>
  );
}

function MCReview({
  item,
  onResult,
}: {
  item: StudyItem;
  onResult: (wasCorrect: boolean) => void;
}) {
  const ea = item.expected_answer as Record<string, unknown>;
  const correctAnswer = String(ea.answer ?? "");
  const explanation = String(ea.explanation ?? "");

  // Build shuffled option list once per item.
  const options = useMemo(() => {
    const all: { text: string; isCorrect: boolean; whyWrong?: string }[] = [
      { text: correctAnswer, isCorrect: true },
      ...item.distractors.map((d: Distractor) => ({
        text: d.text,
        isCorrect: false,
        whyWrong: d.why_wrong,
      })),
    ];
    return shuffle(all);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const revealed = pickedIndex !== null;

  function pick(i: number) {
    if (revealed) return;
    setPickedIndex(i);
  }

  // Keyboard: 1-4 to pick, Space/Enter to advance after reveal.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLInputElement) return;
      if (!revealed) {
        const n = Number(e.key);
        if (n >= 1 && n <= options.length) {
          pick(n - 1);
        }
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        onResult(options[pickedIndex!].isCorrect);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, pickedIndex, options.length]);

  return (
    <Card className="space-y-4 min-h-[300px] flex flex-col">
      <ModeBadge mode={item.mode} />
      <div className="text-lg leading-relaxed">{item.prompt}</div>
      <div className="space-y-2 flex-1">
        {options.map((opt, i) => {
          const picked = pickedIndex === i;
          const showCorrect = revealed && opt.isCorrect;
          const showWrongPick = revealed && picked && !opt.isCorrect;
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={revealed}
              className={
                "w-full text-left rounded-md border px-3 py-2 text-sm transition " +
                (showCorrect
                  ? "border-emerald-600 bg-emerald-950/40 text-emerald-200"
                  : showWrongPick
                    ? "border-rose-700 bg-rose-950/40 text-rose-200"
                    : revealed
                      ? "border-slate-800 bg-slate-950 text-slate-400"
                      : picked
                        ? "border-slate-600 bg-slate-800 text-slate-100"
                        : "border-slate-800 bg-slate-950 text-slate-100 hover:border-slate-600 cursor-pointer")
              }
            >
              <span className="text-slate-500 mr-2">{i + 1}.</span>
              {opt.text}
              {revealed && !opt.isCorrect && opt.whyWrong && (
                <div className="mt-1 text-xs text-slate-500">
                  {opt.whyWrong}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {revealed && (
        <div className="border-t border-slate-800 pt-3 space-y-3">
          {explanation && (
            <div className="text-sm text-slate-400">{explanation}</div>
          )}
          <Button
            onClick={() => onResult(options[pickedIndex!].isCorrect)}
            className="w-full"
          >
            Next
            <span className="ml-2 text-xs opacity-60">[space]</span>
          </Button>
        </div>
      )}
    </Card>
  );
}

function ModeBadge({ mode }: { mode: string }) {
  const label =
    mode === "mc"
      ? "Multiple choice"
      : mode === "fill_blank"
        ? "Fill in the blank"
        : mode === "matching"
          ? "Matching"
          : "Flashcard";
  return (
    <div className="text-xs">
      <span className="rounded bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 text-emerald-300">
        {label}
      </span>
    </div>
  );
}

// ----- Matching review -----

type Pair = { term: string; definition: string };

function MatchingReview({
  item,
  onResult,
}: {
  item: StudyItem;
  onResult: (wasCorrect: boolean) => void;
}) {
  const ea = item.expected_answer as Record<string, unknown>;
  const pairs: Pair[] = (ea.pairs as Pair[]) ?? [];
  const explanation = String(ea.explanation ?? "");

  // Stable left order (as authored). Right order shuffled per item.
  const shuffledRights = useMemo(() => {
    return shuffle(pairs.map((p, i) => ({ definition: p.definition, originalIndex: i })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // Map left index → right's original index that user paired it with.
  const [assignments, setAssignments] = useState<Record<number, number>>({});
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  if (pairs.length === 0) {
    // Malformed matching item — fall back to "no idea" state.
    return (
      <Card className="space-y-4 min-h-[300px]">
        <ModeBadge mode="matching" />
        <div className="text-sm text-rose-300">
          This matching item has no pairs. Regenerate it from the Cards panel.
        </div>
        <Button onClick={() => onResult(false)}>Skip</Button>
      </Card>
    );
  }

  function pickRight(originalIndex: number) {
    if (checked) return;
    if (selectedLeft === null) return;
    // If this right is already assigned to a different left, unassign.
    const newAssignments = { ...assignments };
    for (const [k, v] of Object.entries(newAssignments)) {
      if (v === originalIndex) delete newAssignments[Number(k)];
    }
    newAssignments[selectedLeft] = originalIndex;
    setAssignments(newAssignments);
    setSelectedLeft(null);
  }

  function clearAssignment(leftIdx: number) {
    if (checked) return;
    const next = { ...assignments };
    delete next[leftIdx];
    setAssignments(next);
  }

  const allAssigned = Object.keys(assignments).length === pairs.length;
  const correctCount = pairs.reduce(
    (s, _p, i) => s + (assignments[i] === i ? 1 : 0),
    0,
  );
  const allCorrect = correctCount === pairs.length;

  return (
    <Card className="space-y-4 min-h-[300px] flex flex-col">
      <ModeBadge mode="matching" />
      <div className="text-base leading-relaxed">{item.prompt}</div>

      <div className="grid grid-cols-2 gap-3 flex-1">
        {/* Left: terms */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-slate-500">Terms</div>
          {pairs.map((p, i) => {
            const assigned = assignments[i];
            const isCorrect = checked && assigned === i;
            const isWrong = checked && assigned !== undefined && assigned !== i;
            const selected = selectedLeft === i;
            return (
              <button
                key={i}
                onClick={() => !checked && setSelectedLeft(i)}
                disabled={checked}
                className={
                  "w-full text-left rounded-md border px-3 py-2 text-sm transition " +
                  (isCorrect
                    ? "border-emerald-600 bg-emerald-950/40 text-emerald-200"
                    : isWrong
                      ? "border-rose-700 bg-rose-950/40 text-rose-200"
                      : selected
                        ? "border-emerald-500 bg-slate-800 text-slate-100"
                        : "border-slate-800 bg-slate-950 text-slate-100 hover:border-slate-600 cursor-pointer")
                }
              >
                <div className="font-medium">{p.term}</div>
                {assigned !== undefined && (
                  <div className="mt-1 text-xs text-slate-400 flex items-center gap-2">
                    <span>→ {shuffledRights.find((r) => r.originalIndex === assigned)?.definition}</span>
                    {!checked && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          clearAssignment(i);
                        }}
                        className="text-slate-500 hover:text-slate-200"
                      >
                        ✕
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: definitions */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Definitions
          </div>
          {shuffledRights.map((r) => {
            const usedBy = Object.entries(assignments).find(
              ([, v]) => v === r.originalIndex,
            );
            const used = !!usedBy;
            return (
              <button
                key={r.originalIndex}
                onClick={() => pickRight(r.originalIndex)}
                disabled={checked || selectedLeft === null || used}
                className={
                  "w-full text-left rounded-md border px-3 py-2 text-sm transition " +
                  (used
                    ? "border-slate-800 bg-slate-900 text-slate-500"
                    : selectedLeft !== null
                      ? "border-slate-600 bg-slate-800 text-slate-100 hover:border-emerald-500 cursor-pointer"
                      : "border-slate-800 bg-slate-950 text-slate-300")
                }
              >
                {r.definition}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-800 pt-3 space-y-2">
        {!checked ? (
          <Button
            onClick={() => setChecked(true)}
            disabled={!allAssigned}
            className="w-full"
            title={allAssigned ? "Check answers" : "Assign all terms first"}
          >
            {allAssigned ? "Check answers" : `Assign all (${Object.keys(assignments).length} / ${pairs.length})`}
          </Button>
        ) : (
          <>
            <div
              className={`text-sm ${allCorrect ? "text-emerald-300" : "text-amber-300"}`}
            >
              {correctCount} / {pairs.length} correct
              {!allCorrect && (
                <span className="text-slate-400 ml-2">
                  — counted as {allCorrect ? "got it" : "didn't get it"}
                </span>
              )}
            </div>
            {explanation && (
              <div className="text-xs text-slate-400">{explanation}</div>
            )}
            <Button onClick={() => onResult(allCorrect)} className="w-full">
              Next
              <span className="ml-2 text-xs opacity-60">[space]</span>
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
