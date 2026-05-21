import { useState } from "react";

import {
  useDeleteKnowledgeUnit,
  useGenerateItems,
  useUpdateKnowledgeUnit,
} from "../lib/api";
import type { KnowledgeUnit } from "../lib/types";
import { Button, ErrorText } from "./ui";

export function KURow({ ku, index }: { ku: KnowledgeUnit; index?: number }) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateKnowledgeUnit(ku.id);
  const del = useDeleteKnowledgeUnit();
  const generate = useGenerateItems(ku.id);

  const [summary, setSummary] = useState(ku.concept_summary);
  const [tagsText, setTagsText] = useState(ku.connection_tags.join(", "));

  async function save() {
    await update.mutateAsync({
      concept_summary: summary,
      connection_tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setEditing(false);
  }

  function cancelEdit() {
    setSummary(ku.concept_summary);
    setTagsText(ku.connection_tags.join(", "));
    setEditing(false);
  }

  const hasCard = ku.study_items_count > 0;
  const wrapperClass = editing
    ? "sm:col-span-2 rounded-lg border border-slate-700 bg-slate-900"
    : "rounded-lg border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition";

  return (
    <div className={wrapperClass}>
      {/* Header strip */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 text-xs">
        {typeof index === "number" && (
          <span className="text-slate-500 font-mono">#{index + 1}</span>
        )}
        <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
          {ku.blooms_level}
        </span>
        {hasCard ? (
          <span className="rounded bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 text-emerald-300">
            ✓ card
          </span>
        ) : (
          <span className="rounded bg-amber-950/60 border border-amber-800/50 px-2 py-0.5 text-amber-300">
            ⚠ no card
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {editing ? (
          <EditForm
            summary={summary}
            setSummary={setSummary}
            tagsText={tagsText}
            setTagsText={setTagsText}
            saving={update.isPending}
            onSave={save}
            onCancel={cancelEdit}
            error={update.error as Error | null}
          />
        ) : (
          <Preview ku={ku} />
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
          <Button
            className="!px-2 !py-1 text-xs"
            variant={hasCard ? "ghost" : "primary"}
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            title={hasCard ? "Replace the card for this KU" : "Create a card for this KU"}
          >
            {generate.isPending
              ? "…"
              : hasCard
                ? "Regenerate card"
                : "Generate card"}
          </Button>
          <Button
            className="!px-2 !py-1 text-xs ml-auto"
            variant="ghost"
            onClick={() => {
              if (confirm("Delete this knowledge unit and its card?")) {
                del.mutate(ku.id);
              }
            }}
          >
            Delete
          </Button>
        </div>
      )}
      {generate.error && (
        <div className="px-4 pb-2">
          <ErrorText>{(generate.error as Error).message}</ErrorText>
        </div>
      )}
    </div>
  );
}

// ----- Preview -----

function Preview({ ku }: { ku: KnowledgeUnit }) {
  return (
    <>
      <div className="text-sm leading-relaxed text-slate-100">
        {ku.concept_summary}
      </div>

      {ku.connection_tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ku.connection_tags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] rounded bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 text-emerald-300/90"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {ku.key_terms.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
            Key terms
          </div>
          <ul className="space-y-0.5 text-xs text-slate-300 pl-1">
            {ku.key_terms.map((kt, i) => (
              <li key={i} className="leading-relaxed">
                <span className="text-slate-100 font-medium">{kt.term}</span>:{" "}
                <span className="text-slate-400">{kt.definition}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ku.common_misconceptions.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
            Misconceptions
          </div>
          <ul className="list-disc pl-5 text-xs text-rose-300/80 space-y-0.5">
            {ku.common_misconceptions.map((m, i) => (
              <li key={i} className="leading-relaxed">
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

// ----- Edit form -----

function EditForm({
  summary,
  setSummary,
  tagsText,
  setTagsText,
  saving,
  onSave,
  onCancel,
  error,
}: {
  summary: string;
  setSummary: (v: string) => void;
  tagsText: string;
  setTagsText: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  error: Error | null;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
          Summary
        </div>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
          className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 leading-relaxed"
        />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
          Tags (comma-separated)
        </div>
        <input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
        />
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
