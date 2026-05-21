import { useState } from "react";

import {
  useDeleteStudyItem,
  useGenerateItems,
  useUpdateStudyItem,
} from "../lib/api";
import type { Distractor, StudyItem } from "../lib/types";
import { Button, ErrorText } from "./ui";

// ----- Helpers: read answer/explanation with legacy fallbacks -----

function readAnswer(item: StudyItem): string {
  const ea = item.expected_answer as Record<string, unknown>;
  if (ea.answer) return String(ea.answer);
  if (Array.isArray(ea.acceptable_answers) && ea.acceptable_answers.length > 0) {
    return String(ea.acceptable_answers[0]);
  }
  if (ea.model_answer) return String(ea.model_answer);
  return "";
}

function readExplanation(item: StudyItem): string {
  const ea = item.expected_answer as Record<string, unknown>;
  return String(ea.explanation ?? ea.rationale ?? "");
}

function readPairs(item: StudyItem): { term: string; definition: string }[] {
  const ea = item.expected_answer as Record<string, unknown>;
  return Array.isArray(ea.pairs) ? (ea.pairs as { term: string; definition: string }[]) : [];
}

function isIncomplete(item: StudyItem): boolean {
  if (item.mode === "matching") return readPairs(item).length < 4;
  return !readAnswer(item) || item.distractors.length === 0;
}

function modeLabel(mode: string): string {
  switch (mode) {
    case "mc":
      return "Multiple choice";
    case "fill_blank":
      return "Fill in the blank";
    case "matching":
      return "Matching";
    case "scenario":
      return "Scenario";
    case "free_response":
      return "Free response";
    case "flashcard":
      return "Flashcard";
    default:
      return mode;
  }
}

function modeBadgeColor(mode: string): string {
  switch (mode) {
    case "mc":
      return "bg-sky-950/60 border-sky-800/50 text-sky-300";
    case "fill_blank":
      return "bg-violet-950/60 border-violet-800/50 text-violet-300";
    case "matching":
      return "bg-amber-950/60 border-amber-800/50 text-amber-300";
    default:
      return "bg-slate-800 border-slate-700 text-slate-300";
  }
}

// ----- Component -----

export function CardRow({
  item,
  kuLabel,
  index,
}: {
  item: StudyItem;
  kuLabel?: string;
  index?: number;
}) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateStudyItem(item.id);
  const del = useDeleteStudyItem();
  const regenerate = useGenerateItems(item.knowledge_unit);

  const initialAnswer = readAnswer(item);
  const initialExplanation = readExplanation(item);
  const initialDistractors: Distractor[] =
    item.distractors.length > 0
      ? item.distractors
      : [
          { text: "", why_wrong: "" },
          { text: "", why_wrong: "" },
          { text: "", why_wrong: "" },
        ];

  const [prompt, setPrompt] = useState(item.prompt);
  const [answer, setAnswer] = useState(initialAnswer);
  const [explanation, setExplanation] = useState(initialExplanation);
  const [distractors, setDistractors] = useState<Distractor[]>(initialDistractors);

  async function save() {
    await update.mutateAsync({
      prompt,
      expected_answer: { answer, explanation } as unknown as Record<string, unknown>,
      distractors: distractors.filter((d) => d.text.trim()),
    });
    setEditing(false);
  }

  function cancelEdit() {
    setPrompt(item.prompt);
    setAnswer(initialAnswer);
    setExplanation(initialExplanation);
    setDistractors(initialDistractors);
    setEditing(false);
  }

  const incomplete = isIncomplete(item);

  // When editing, this card spans both columns of the parent grid.
  const wrapperClass = editing
    ? "sm:col-span-2 rounded-lg border border-slate-700 bg-slate-900"
    : "rounded-lg border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition";

  return (
    <div className={wrapperClass}>
      {/* Header strip: index + mode + bloom + KU + incomplete badge */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 text-xs">
        {typeof index === "number" && (
          <span className="text-slate-500 font-mono">#{index + 1}</span>
        )}
        <span className={`rounded border px-2 py-0.5 ${modeBadgeColor(item.mode)}`}>
          {modeLabel(item.mode)}
        </span>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
          {item.blooms_level}
        </span>
        {incomplete && (
          <span className="rounded bg-rose-950/60 border border-rose-800/50 px-2 py-0.5 text-rose-300">
            ⚠ incomplete
          </span>
        )}
        {kuLabel && !editing && (
          <span
            className="ml-auto text-slate-500 truncate max-w-[14rem]"
            title={kuLabel}
          >
            {kuLabel}
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {editing ? (
          <EditForm
            prompt={prompt}
            setPrompt={setPrompt}
            answer={answer}
            setAnswer={setAnswer}
            explanation={explanation}
            setExplanation={setExplanation}
            distractors={distractors}
            setDistractors={setDistractors}
            saving={update.isPending}
            onSave={save}
            onCancel={cancelEdit}
            error={update.error as Error | null}
          />
        ) : item.mode === "matching" ? (
          <MatchingPreview
            prompt={item.prompt}
            pairs={readPairs(item)}
            explanation={initialExplanation}
            incomplete={incomplete}
          />
        ) : (
          <Preview
            prompt={item.prompt}
            answer={initialAnswer}
            distractors={item.distractors}
            explanation={initialExplanation}
            incomplete={incomplete}
          />
        )}
      </div>

      {!editing && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-slate-800">
          <Button
            className="!px-2 !py-1 text-xs"
            variant="secondary"
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
          {incomplete && (
            <Button
              className="!px-2 !py-1 text-xs"
              onClick={() => regenerate.mutate()}
              disabled={regenerate.isPending}
              title="Regenerate this card (calls Claude to re-create it)"
            >
              {regenerate.isPending ? "Regenerating…" : "Regenerate"}
            </Button>
          )}
          <Button
            className="!px-2 !py-1 text-xs ml-auto"
            variant="ghost"
            onClick={() => {
              if (confirm("Delete this card?")) del.mutate(item.id);
            }}
          >
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}

// ----- Preview (default view) -----

function Preview({
  prompt,
  answer,
  distractors,
  explanation,
  incomplete,
}: {
  prompt: string;
  answer: string;
  distractors: Distractor[];
  explanation: string;
  incomplete: boolean;
}) {
  return (
    <>
      <div className="text-sm leading-relaxed text-slate-100">{prompt}</div>
      <div className="space-y-1.5 pt-1">
        {answer && (
          <div className="flex items-start gap-2 text-sm">
            <span className="text-emerald-400 mt-0.5">✓</span>
            <span className="text-emerald-300">{answer}</span>
          </div>
        )}
        {distractors.map((d, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <span className="text-slate-500 mt-0.5">○</span>
            <span className="text-slate-400">
              {d.text}
              {d.why_wrong && (
                <span className="text-slate-600"> — {d.why_wrong}</span>
              )}
            </span>
          </div>
        ))}
        {incomplete && (
          <div className="text-xs text-amber-400/80 pt-1">
            This card is missing {!answer ? "an answer" : ""}
            {!answer && distractors.length === 0 ? " and " : ""}
            {distractors.length === 0 ? "distractors" : ""}. Regenerate to fix.
          </div>
        )}
      </div>
      {explanation && (
        <div className="pt-2 border-t border-slate-800/60 text-xs text-slate-400 italic leading-relaxed">
          {explanation}
        </div>
      )}
    </>
  );
}

// ----- Matching preview -----

function MatchingPreview({
  prompt,
  pairs,
  explanation,
  incomplete,
}: {
  prompt: string;
  pairs: { term: string; definition: string }[];
  explanation: string;
  incomplete: boolean;
}) {
  return (
    <>
      <div className="text-sm leading-relaxed text-slate-100">{prompt}</div>
      {pairs.length > 0 && (
        <ul className="space-y-1 pt-1 text-sm">
          {pairs.map((p, i) => (
            <li key={i} className="leading-relaxed">
              <span className="text-amber-300 font-medium">{p.term}</span>
              <span className="text-slate-500"> → </span>
              <span className="text-slate-300">{p.definition}</span>
            </li>
          ))}
        </ul>
      )}
      {incomplete && (
        <div className="text-xs text-rose-300/80 pt-1">
          Matching needs at least 4 pairs. Regenerate to fix.
        </div>
      )}
      {explanation && (
        <div className="pt-2 border-t border-slate-800/60 text-xs text-slate-400 italic leading-relaxed">
          {explanation}
        </div>
      )}
    </>
  );
}

// ----- Edit form -----

function EditForm({
  prompt,
  setPrompt,
  answer,
  setAnswer,
  explanation,
  setExplanation,
  distractors,
  setDistractors,
  saving,
  onSave,
  onCancel,
  error,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  answer: string;
  setAnswer: (v: string) => void;
  explanation: string;
  setExplanation: (v: string) => void;
  distractors: Distractor[];
  setDistractors: (d: Distractor[]) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  error: Error | null;
}) {
  return (
    <div className="space-y-3">
      <Field label="Prompt">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 leading-relaxed"
        />
      </Field>
      <Field label="Correct answer">
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
        />
      </Field>
      <Field label="Explanation">
        <input
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
        />
      </Field>
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-slate-400">
          Distractors (wrong options)
        </div>
        {distractors.map((d, i) => (
          <div key={i} className="space-y-1">
            <input
              value={d.text}
              onChange={(e) => {
                const next = [...distractors];
                next[i] = { ...next[i], text: e.target.value };
                setDistractors(next);
              }}
              placeholder={`Distractor ${i + 1}`}
              className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
            />
            <input
              value={d.why_wrong}
              onChange={(e) => {
                const next = [...distractors];
                next[i] = { ...next[i], why_wrong: e.target.value };
                setDistractors(next);
              }}
              placeholder="Why this is wrong (shown as feedback if picked)"
              className="w-full rounded bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-400"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {error && <ErrorText>{error.message}</ErrorText>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}
