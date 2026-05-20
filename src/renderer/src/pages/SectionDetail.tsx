import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  useGenerateSectionItems,
  useIngestNotes,
  useKnowledgeUnits,
  useSection,
  useUpdateSection,
} from "../lib/api";
import { Button, Card, ErrorText, Spinner } from "../components/ui";
import { KnowledgeUnitCard } from "../components/KnowledgeUnitCard";

type Tab = "notes" | "kus";

export default function SectionDetail() {
  const { courseId, sectionId } = useParams();
  const id = sectionId ? Number(sectionId) : undefined;

  const section = useSection(id);
  const kus = useKnowledgeUnits(id);

  // Default to KUs tab if any exist, otherwise notes.
  const [tab, setTab] = useState<Tab>("notes");
  const [tabInitialized, setTabInitialized] = useState(false);
  useEffect(() => {
    if (!tabInitialized && kus.data) {
      setTab(kus.data.length > 0 ? "kus" : "notes");
      setTabInitialized(true);
    }
  }, [kus.data, tabInitialized]);

  if (section.isLoading) return <Spinner />;
  if (section.error)
    return <ErrorText>{(section.error as Error).message}</ErrorText>;
  if (!section.data || id === undefined) return null;

  const kuCount = section.data.knowledge_units_count;

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
          {kuCount} knowledge units · difficulty {section.data.difficulty}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 -mb-px">
        <TabButton active={tab === "notes"} onClick={() => setTab("notes")}>
          Notes
        </TabButton>
        <TabButton active={tab === "kus"} onClick={() => setTab("kus")}>
          Knowledge units{kuCount > 0 ? ` (${kuCount})` : ""}
        </TabButton>
      </div>

      {tab === "notes" ? (
        <NotesTab sectionId={id} initialNotes={section.data.notes} />
      ) : (
        <KUsTab sectionId={id} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition " +
        (active
          ? "border-emerald-500 text-slate-100"
          : "border-transparent text-slate-400 hover:text-slate-200")
      }
    >
      {children}
    </button>
  );
}

// ----- Notes tab -----

function NotesTab({
  sectionId,
  initialNotes,
}: {
  sectionId: number;
  initialNotes: string;
}) {
  const kus = useKnowledgeUnits(sectionId);
  const updateSection = useUpdateSection(sectionId);
  const ingest = useIngestNotes(sectionId);

  const [notes, setNotes] = useState<string>("");
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    if (!synced) {
      setNotes(initialNotes);
      setSynced(true);
    }
  }, [initialNotes, synced]);

  const [ingestResult, setIngestResult] = useState<string | null>(null);
  const hasUnsavedNotes = synced && notes !== initialNotes;
  const hasKUs = (kus.data?.length ?? 0) > 0;

  async function saveNotes() {
    await updateSection.mutateAsync({ notes });
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
    if (hasUnsavedNotes) {
      await updateSection.mutateAsync({ notes });
    }
    const res = await ingest.mutateAsync({ replace: willReplace });
    setIngestResult(`Created ${res.created.length} knowledge units.`);
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Section notes</h2>
        {hasUnsavedNotes && (
          <span className="text-xs text-amber-400">Unsaved changes</span>
        )}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={notes ? Math.min(24, Math.max(8, notes.split("\n").length + 2)) : 10}
        placeholder="Paste or write your notes here. Click Save to persist them. Click Ingest to turn them into knowledge units."
        className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-600 font-mono"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={saveNotes}
          disabled={!hasUnsavedNotes || updateSection.isPending}
        >
          {updateSection.isPending ? "Saving…" : "Save notes"}
        </Button>
        <Button
          onClick={runIngest}
          disabled={ingest.isPending || !notes.trim()}
        >
          {ingest.isPending ? "Ingesting…" : "Ingest notes → KUs"}
        </Button>
        {ingest.isPending && (
          <span className="text-xs text-slate-400 self-center">10-30 sec</span>
        )}
      </div>
      {ingest.error && (
        <ErrorText>{(ingest.error as Error).message}</ErrorText>
      )}
      {ingestResult && (
        <div className="text-xs text-emerald-300">{ingestResult}</div>
      )}
    </Card>
  );
}

// ----- KUs tab -----

function KUsTab({ sectionId }: { sectionId: number }) {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const kus = useKnowledgeUnits(sectionId);
  const generateAll = useGenerateSectionItems(sectionId);
  const [generateResult, setGenerateResult] = useState<string | null>(null);

  const hasKUs = (kus.data?.length ?? 0) > 0;
  const kusWithoutItems =
    kus.data?.filter((k) => k.study_items_count === 0).length ?? 0;
  const totalItems =
    kus.data?.reduce((sum, k) => sum + k.study_items_count, 0) ?? 0;

  async function runGenerateAll(regenerate: boolean) {
    setGenerateResult(null);
    if (regenerate) {
      const ok = confirm(
        `Regenerate study items for ALL ${kus.data?.length ?? 0} knowledge units? Existing items will be deleted.`,
      );
      if (!ok) return;
    }
    const res = await generateAll.mutateAsync({ regenerate });
    const parts = [`Generated: ${res.generated}`, `Skipped: ${res.skipped}`];
    if (res.errors.length) parts.push(`Errors: ${res.errors.length}`);
    setGenerateResult(parts.join(" · "));
  }

  return (
    <div className="space-y-4">
      {hasKUs && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-slate-400">
            {kusWithoutItems > 0
              ? `${kusWithoutItems} KU(s) without study items`
              : `${totalItems} study items across ${kus.data?.length ?? 0} KU(s)`}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() =>
                navigate(`/courses/${courseId}/sections/${sectionId}/review`)
              }
              disabled={totalItems === 0}
              title={
                totalItems === 0
                  ? "No items to review yet"
                  : `Review ${totalItems} items in this section`
              }
            >
              ▶ Review section
            </Button>
            <Button
              variant="secondary"
              onClick={() => runGenerateAll(false)}
              disabled={generateAll.isPending || kusWithoutItems === 0}
              title={
                kusWithoutItems === 0
                  ? "All KUs already have items"
                  : `Generate items for ${kusWithoutItems} KU(s) without items`
              }
            >
              {generateAll.isPending
                ? "Generating…"
                : `Generate items (${kusWithoutItems} pending)`}
            </Button>
            <Button
              variant="ghost"
              onClick={() => runGenerateAll(true)}
              disabled={generateAll.isPending}
            >
              Regenerate all
            </Button>
          </div>
        </div>
      )}

      {generateAll.isPending && (
        <div className="text-xs text-slate-400">
          Calling Claude for {kusWithoutItems} KU(s) in parallel — this may take
          30 seconds.
        </div>
      )}
      {generateAll.error && (
        <ErrorText>{(generateAll.error as Error).message}</ErrorText>
      )}
      {generateResult && (
        <div className="text-xs text-emerald-300">{generateResult}</div>
      )}

      {kus.isLoading && <Spinner />}
      {kus.data && kus.data.length === 0 && (
        <Card>
          <div className="text-slate-400 text-sm">
            No knowledge units yet. Go to the <b>Notes</b> tab, add notes, and
            click <b>Ingest</b>.
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {kus.data?.map((ku) => (
          <KnowledgeUnitCard key={ku.id} ku={ku} />
        ))}
      </div>
    </div>
  );
}
