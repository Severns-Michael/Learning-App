import { useState } from "react";

import {
  useDeleteKnowledgeUnit,
  useDeleteStudyItem,
  useGenerateItems,
  useStudyItems,
} from "../lib/api";
import type { KnowledgeUnit } from "../lib/types";
import { MODE_LABELS, STUDY_MODES } from "../lib/types";
import { Button, Card, ErrorText, Spinner } from "./ui";
import { StudyItemCard } from "./StudyItemCard";

export function KnowledgeUnitCard({ ku }: { ku: KnowledgeUnit }) {
  const [expanded, setExpanded] = useState(false);
  const items = useStudyItems(expanded ? ku.id : undefined);
  const generate = useGenerateItems(ku.id);
  const deleteKU = useDeleteKnowledgeUnit();
  const deleteItem = useDeleteStudyItem();

  const hasItems = ku.study_items_count > 0;

  async function onGenerate() {
    if (hasItems) {
      if (!confirm(`Regenerate items? This deletes the ${ku.study_items_count} existing item(s).`)) {
        return;
      }
    }
    setExpanded(true);
    await generate.mutateAsync();
  }

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium leading-snug flex-1">
          {ku.concept_summary}
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            if (confirm("Delete this knowledge unit?")) deleteKU.mutate(ku.id);
          }}
          title="Delete"
        >
          ✕
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
          {ku.blooms_level}
        </span>
        {ku.connection_tags.map((tag) => (
          <span
            key={tag}
            className="rounded bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 text-emerald-300"
          >
            {tag}
          </span>
        ))}
      </div>

      {ku.key_terms.length > 0 && (
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer hover:text-slate-200">
            {ku.key_terms.length} key terms
          </summary>
          <ul className="mt-2 space-y-1 pl-4">
            {ku.key_terms.map((kt, i) => (
              <li key={i}>
                <span className="text-slate-200">{kt.term}</span>: {kt.definition}
              </li>
            ))}
          </ul>
        </details>
      )}

      {ku.common_misconceptions.length > 0 && (
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer hover:text-slate-200">
            Common misconceptions
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-rose-300">
            {ku.common_misconceptions.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
        <div className="text-xs text-slate-400">
          {hasItems ? `${ku.study_items_count} study items` : "No study items yet"}
        </div>
        <div className="flex gap-2">
          {hasItems && (
            <Button
              variant="ghost"
              className="text-xs"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "Hide items" : "View items"}
            </Button>
          )}
          <Button
            variant={hasItems ? "secondary" : "primary"}
            className="text-xs"
            disabled={generate.isPending}
            onClick={onGenerate}
          >
            {generate.isPending
              ? "Generating…"
              : hasItems
                ? "Regenerate"
                : "Generate items"}
          </Button>
        </div>
      </div>

      {generate.isPending && (
        <div className="text-xs text-slate-400">
          Calling Claude — this may take 10-30 seconds.
        </div>
      )}
      {generate.error && (
        <ErrorText>{(generate.error as Error).message}</ErrorText>
      )}

      {expanded && (
        <div className="pt-2 border-t border-slate-800/60 space-y-3">
          {items.isLoading && <Spinner />}
          {items.error && (
            <ErrorText>{(items.error as Error).message}</ErrorText>
          )}
          {items.data && items.data.length === 0 && !generate.isPending && (
            <div className="text-xs text-slate-500">No items yet.</div>
          )}
          {items.data && items.data.length > 0 && (
            <>
              <ModeBreakdown items={items.data} />
              {items.data.map((it) => (
                <StudyItemCard
                  key={it.id}
                  item={it}
                  onDelete={() => deleteItem.mutate(it.id)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function ModeBreakdown({ items }: { items: { mode: string }[] }) {
  const counts = STUDY_MODES.map((m) => ({
    mode: m,
    count: items.filter((it) => it.mode === m).length,
  }));
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {counts.map((c) => (
        <span
          key={c.mode}
          className={`rounded px-2 py-0.5 ${
            c.count > 0
              ? "bg-slate-800 text-slate-200"
              : "bg-slate-900 text-slate-600 line-through"
          }`}
        >
          {MODE_LABELS[c.mode as keyof typeof MODE_LABELS]} ×{c.count}
        </span>
      ))}
    </div>
  );
}
