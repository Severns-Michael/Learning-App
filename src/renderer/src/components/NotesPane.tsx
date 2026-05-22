import { useCallback, useEffect, useRef, useState } from "react";

import {
  useEnhanceNotes,
  useIngestNotes,
  useKnowledgeUnits,
  useUpdateSection,
  type EnhanceMode,
} from "../lib/api";
import { Button, Card, MutationError } from "./ui";
import { EnhanceMergeModal } from "./EnhanceMergeModal";
import { NotesEditor } from "./NotesEditor";
import { PaginatedPreview } from "./PaginatedPreview";

const AUTOSAVE_DEBOUNCE_MS = 1200;

/**
 * Count "AI blanks" in notes. Two forms:
 *   - $$            → context blank (one blank)
 *   - $$ ... $$    → instruction blank (one blank, regardless of text inside)
 */
function countBlanks(text: string): number {
  // Match the instruction form first (non-greedy text between $$ ... $$).
  // Then count remaining standalone $$ in what's left.
  const INSTRUCTION_RE = /\$\$([\s\S]+?)\$\$/g;
  const instructional = (text.match(INSTRUCTION_RE) ?? []).length;
  const remainder = text.replace(INSTRUCTION_RE, "");
  const standalone = (remainder.match(/\$\$/g) ?? []).length;
  return instructional + standalone;
}

type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

export function NotesPane({
  sectionId,
  initialNotes,
}: {
  sectionId: number;
  initialNotes: string;
}) {
  const kus = useKnowledgeUnits(sectionId);
  const updateSection = useUpdateSection(sectionId);
  const ingest = useIngestNotes(sectionId);
  const enhance = useEnhanceNotes(sectionId);

  const [notes, setNotes] = useState<string>("");
  const [synced, setSynced] = useState(false);
  const [editorMode, setEditorMode] = useState<"wysiwyg" | "raw">("wysiwyg");
  const [previewing, setPreviewing] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const lastSavedRef = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePageCount = useCallback((n: number) => setPageCount(n), []);

  useEffect(() => {
    if (!synced) {
      setNotes(initialNotes);
      lastSavedRef.current = initialNotes;
      setSynced(true);
    }
  }, [initialNotes, synced]);

  const [ingestResult, setIngestResult] = useState<string | null>(null);
  const [enhanceResult, setEnhanceResult] = useState<
    { original: string; enhanced: string; mode: EnhanceMode } | null
  >(null);
  const hasUnsavedNotes = synced && notes !== lastSavedRef.current;
  const hasKUs = (kus.data?.length ?? 0) > 0;
  const blankCount = countBlanks(notes);

  async function saveNow(text: string) {
    setSaveState({ kind: "saving" });
    try {
      await updateSection.mutateAsync({ notes: text });
      lastSavedRef.current = text;
      setSaveState({ kind: "saved", at: Date.now() });
    } catch (e) {
      setSaveState({ kind: "error", message: (e as Error).message });
    }
  }

  // Autosave: debounce edits, save after typing stops.
  useEffect(() => {
    if (!synced) return;
    if (notes === lastSavedRef.current) return;
    setSaveState({ kind: "dirty" });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveNow(notes);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, synced]);

  // Warn on navigate-away if a save is pending.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (hasUnsavedNotes) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedNotes]);

  async function flushSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (notes !== lastSavedRef.current) {
      await saveNow(notes);
    }
  }

  async function runEnhance(mode: EnhanceMode) {
    if (!notes.trim()) return;
    if (mode === "fill_blanks" && blankCount === 0) return;
    await flushSave();
    setEnhanceResult(null);
    const res = await enhance.mutateAsync({ text: notes, mode });
    setEnhanceResult({ ...res, mode });
  }

  async function runIngest() {
    setIngestResult(null);
    let willReplace = false;
    if (hasKUs) {
      willReplace = confirm(
        `This section already has ${kus.data?.length ?? 0} knowledge units. Replace them with new ones extracted from these notes?`,
      );
      if (!willReplace) return;
    }
    await flushSave();
    const res = await ingest.mutateAsync({ replace: willReplace });
    setIngestResult(`Created ${res.created.length} knowledge units.`);
  }

  async function openPreview() {
    await flushSave();
    setPreviewing(true);
  }

  function printFromPreview() {
    // The preview canvas IS what prints — same .notes-view DOM, light theme.
    // Print CSS hides the no-print chrome (toolbar, buttons, app nav).
    window.print();
  }

  if (previewing) {
    return (
      <Card className="space-y-3">
        <div className="no-print flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-medium">Print preview</h2>
            <span className="text-xs text-slate-400">
              {pageCount} page{pageCount === 1 ? "" : "s"} · US Letter, 0.5" margins
            </span>
          </div>
          <div className="flex gap-2">
            <Button onClick={printFromPreview}>🖨 Print</Button>
            <Button variant="ghost" onClick={() => setPreviewing(false)}>
              ← Back to editor
            </Button>
          </div>
        </div>
        <div className="bg-slate-950/60 overflow-auto max-h-[75vh] rounded">
          <PaginatedPreview markdown={notes} onPageCount={handlePageCount} />
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="no-print flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium">Notes</h2>
          <SaveIndicator state={saveState} />
        </div>
        <div className="inline-flex rounded-md border border-slate-700 overflow-hidden text-xs">
          <button
            onClick={() => setEditorMode("wysiwyg")}
            className={
              "px-3 py-1 " +
              (editorMode === "wysiwyg"
                ? "bg-emerald-700 text-white"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800")
            }
            title="Rich editor (Word-style)"
          >
            Rich
          </button>
          <button
            onClick={() => setEditorMode("raw")}
            className={
              "px-3 py-1 " +
              (editorMode === "raw"
                ? "bg-emerald-700 text-white"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800")
            }
            title="Raw markdown source"
          >
            Raw
          </button>
        </div>
      </div>

      {editorMode === "wysiwyg" ? (
        <NotesEditor value={notes} onChange={setNotes} />
      ) : (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={Math.max(20, Math.min(40, (notes || "").split("\n").length + 4))}
          placeholder={
            "Raw markdown. Pipe-tables (| col | col |), code blocks, $$ placeholders all work.\n\n" +
            "Switch to Rich to see it rendered."
          }
          spellCheck
          className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-[13px] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-600 leading-relaxed font-mono"
        />
      )}

      <div className="no-print flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => runEnhance("polish")}
          disabled={enhance.isPending || !notes.trim()}
          title="Fix spelling/grammar/structure. Won't add new content. You review the diff before it applies."
        >
          {enhance.isPending && enhanceResult === null ? "Working…" : "✨ Polish"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => runEnhance("expand")}
          disabled={enhance.isPending || !notes.trim()}
          title="Fill in missing detail. Adds definitions, sub-topics, structure for stubby notes. You review the diff before it applies."
        >
          {enhance.isPending && enhanceResult === null ? "Working…" : "📚 Expand"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => runEnhance("fill_blanks")}
          disabled={enhance.isPending || blankCount === 0}
          title={
            blankCount === 0
              ? "Type $$ to mark a blank (e.g. `Subnet mask - $$`) or $$your instruction$$ to give the AI explicit guidance. Then click Fill blanks."
              : `Ask the AI to fill ${blankCount} blank${blankCount === 1 ? "" : "s"}.`
          }
        >
          {enhance.isPending && enhanceResult === null
            ? "Working…"
            : `🔍 Fill blanks${blankCount > 0 ? ` (${blankCount})` : ""}`}
        </Button>
        <Button
          variant="ghost"
          onClick={openPreview}
          title="Open print preview — see how the notes will look on paper, then print."
        >
          🖨 Print preview
        </Button>
        <Button onClick={runIngest} disabled={ingest.isPending || !notes.trim()}>
          {ingest.isPending ? "Ingesting…" : "Ingest notes → KUs"}
        </Button>
        {(ingest.isPending || enhance.isPending) && (
          <span className="text-xs text-slate-400 self-center">
            {enhance.isPending ? "10-25 sec" : "10-30 sec"}
          </span>
        )}
      </div>
      <MutationError mutation={ingest} />
      <MutationError mutation={enhance} />
      {ingestResult && (
        <div className="no-print text-xs text-emerald-300">{ingestResult}</div>
      )}

      {enhanceResult && (
        <EnhanceMergeModal
          open
          onClose={() => setEnhanceResult(null)}
          original={enhanceResult.original}
          enhanced={enhanceResult.enhanced}
          sectionId={sectionId}
          onApply={(merged) => setNotes(merged)}
        />
      )}
    </Card>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state.kind === "idle") return null;
  if (state.kind === "dirty")
    return <span className="text-xs text-amber-400">Unsaved…</span>;
  if (state.kind === "saving")
    return <span className="text-xs text-slate-400">Saving…</span>;
  if (state.kind === "error")
    return (
      <span className="text-xs text-rose-400" title={state.message}>
        Save failed
      </span>
    );
  const t = new Date(state.at);
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  return (
    <span className="text-xs text-emerald-400">
      Saved {hh}:{mm}
    </span>
  );
}
