import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  useDeleteKnowledgeUnit,
  useIngestNotes,
  useKnowledgeUnits,
  useSection,
} from "../lib/api";
import { Button, Card, ErrorText, Label, Spinner } from "../components/ui";

export default function SectionDetail() {
  const { courseId, sectionId } = useParams();
  const id = sectionId ? Number(sectionId) : undefined;
  const section = useSection(id);
  const kus = useKnowledgeUnits(id);
  const ingest = useIngestNotes(id ?? 0);
  const deleteKU = useDeleteKnowledgeUnit();

  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || id === undefined) return;
    await ingest.mutateAsync(text.trim());
    setText("");
    setShowForm(false);
  }

  if (section.isLoading) return <Spinner />;
  if (section.error)
    return <ErrorText>{(section.error as Error).message}</ErrorText>;
  if (!section.data) return null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/courses/${courseId}`}
          className="text-sm text-slate-400 hover:text-slate-100"
        >
          ← Course
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{section.data.title}</h1>
        <div className="mt-1 text-xs text-slate-400">
          {section.data.knowledge_units_count} knowledge units · difficulty{" "}
          {section.data.difficulty}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Knowledge units</h2>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>+ Ingest notes</Button>
        )}
      </div>

      {showForm && (
        <Card>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Paste raw notes</Label>
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={12}
                placeholder="Paste a chapter, lecture notes, or any block of study material. Claude will extract atomic concepts."
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-600 font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={ingest.isPending || !text.trim()}>
                {ingest.isPending ? "Extracting concepts…" : "Ingest"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setText("");
                  setShowForm(false);
                }}
              >
                Cancel
              </Button>
            </div>
            {ingest.isPending && (
              <div className="text-xs text-slate-400">
                This may take 10-30 seconds depending on note length.
              </div>
            )}
            {ingest.error && (
              <ErrorText>{(ingest.error as Error).message}</ErrorText>
            )}
          </form>
        </Card>
      )}

      {kus.isLoading && <Spinner />}
      {kus.data && kus.data.length === 0 && !showForm && (
        <Card>
          <div className="text-slate-400 text-sm">
            No knowledge units yet. Paste your notes and Claude will extract
            them.
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {kus.data?.map((ku) => (
          <Card key={ku.id} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-medium leading-snug flex-1">
                {ku.concept_summary}
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  if (confirm("Delete this knowledge unit?")) {
                    deleteKU.mutate(ku.id);
                  }
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
                      <span className="text-slate-200">{kt.term}</span>:{" "}
                      {kt.definition}
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
          </Card>
        ))}
      </div>
    </div>
  );
}
