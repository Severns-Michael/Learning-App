import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  useEnhanceNotes,
  useGenerateSectionItems,
  useIngestNotes,
  useKnowledgeUnits,
  useSection,
  useSectionStudyItems,
  useUpdateSection,
} from "../lib/api";
import { Button, Card, ErrorText, Spinner } from "../components/ui";
import { KURow } from "../components/KURow";
import { CardRow } from "../components/CardRow";
import { Modal } from "../components/Modal";
import { EnhanceMergeModal } from "../components/EnhanceMergeModal";

type Panel = "kus" | "cards" | null;

export default function SectionDetail() {
  const navigate = useNavigate();
  const { courseId, sectionId } = useParams();
  const id = sectionId ? Number(sectionId) : undefined;

  const section = useSection(id);
  const kus = useKnowledgeUnits(id);
  const items = useSectionStudyItems(id);

  const [panel, setPanel] = useState<Panel>(null);

  if (section.isLoading) return <Spinner />;
  if (section.error)
    return <ErrorText>{(section.error as Error).message}</ErrorText>;
  if (!section.data || id === undefined) return null;

  const kuCount = kus.data?.length ?? 0;
  const cardCount = items.data?.length ?? 0;
  const kuTitleById = new Map(
    (kus.data ?? []).map((k) => [k.id, k.concept_summary]),
  );

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
          difficulty {section.data.difficulty}
        </div>
      </div>

      {/* Clickable tile row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile
          label="Knowledge units"
          value={kuCount}
          sub="click to view & edit"
          onClick={() => setPanel("kus")}
        />
        <Tile
          label="Cards"
          value={cardCount}
          sub="click to view & edit"
          onClick={() => setPanel("cards")}
        />
        <Tile
          label="Review"
          value="▶"
          sub={cardCount > 0 ? `${cardCount} cards` : "no cards yet"}
          onClick={() =>
            cardCount > 0 &&
            navigate(`/courses/${courseId}/sections/${id}/review`)
          }
          disabled={cardCount === 0}
          accent="emerald"
        />
      </div>

      {/* Notes — full width, center stage */}
      <NotesPane sectionId={id} initialNotes={section.data.notes} />

      {/* Modals */}
      <Modal
        open={panel === "kus"}
        onClose={() => setPanel(null)}
        title={`Knowledge units (${kuCount})`}
        rightActions={<KUGenerateButton sectionId={id} kus={kus.data ?? []} />}
      >
        <KUsPanelContent
          kus={kus.data ?? []}
          isLoading={kus.isLoading}
        />
      </Modal>

      <Modal
        open={panel === "cards"}
        onClose={() => setPanel(null)}
        title={`Cards (${cardCount})`}
        rightActions={
          cardCount > 0 && (
            <Button
              className="!px-2 !py-1 text-xs"
              onClick={() => {
                setPanel(null);
                navigate(`/courses/${courseId}/sections/${id}/review`);
              }}
            >
              ▶ Review
            </Button>
          )
        }
      >
        <CardsPanelContent
          items={items.data ?? []}
          isLoading={items.isLoading}
          kuTitleById={(id) => kuTitleById.get(id)}
        />
      </Modal>
    </div>
  );
}

// ----- KUs panel content -----

function KUsPanelContent({
  kus,
  isLoading,
}: {
  kus: import("../lib/types").KnowledgeUnit[];
  isLoading: boolean;
}) {
  const [filter, setFilter] = useState("");
  const filtered = filter.trim()
    ? kus.filter((k) => {
        const q = filter.trim().toLowerCase();
        return (
          k.concept_summary.toLowerCase().includes(q) ||
          k.connection_tags.some((t) => t.toLowerCase().includes(q))
        );
      })
    : kus;

  return (
    <div className="space-y-4">
      {kus.length > 0 && (
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search summaries or tags…"
          className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-600"
        />
      )}

      {isLoading && <Spinner />}
      {kus.length === 0 && (
        <div className="text-sm text-slate-400">
          No knowledge units yet. Paste notes below and click <b>Ingest</b>.
        </div>
      )}
      {kus.length > 0 && filtered.length === 0 && (
        <div className="text-sm text-slate-400">No KUs match "{filter}".</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 auto-rows-min">
        {filtered.map((ku, idx) => (
          <KURow key={ku.id} ku={ku} index={idx} />
        ))}
      </div>
    </div>
  );
}

// ----- Cards panel content -----

function CardsPanelContent({
  items,
  isLoading,
  kuTitleById,
}: {
  items: import("../lib/types").StudyItem[];
  isLoading: boolean;
  kuTitleById: (id: number) => string | undefined;
}) {
  const [filter, setFilter] = useState("");
  const filtered = filter.trim()
    ? items.filter((it) =>
        it.prompt.toLowerCase().includes(filter.trim().toLowerCase()),
      )
    : items;

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search prompts…"
          className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-600"
        />
      )}

      {isLoading && <Spinner />}
      {items.length === 0 && (
        <div className="text-sm text-slate-400">
          No cards yet. Open the <b>Knowledge units</b> panel and click{" "}
          <b>Generate card</b>, or use the bulk generate button there.
        </div>
      )}
      {items.length > 0 && filtered.length === 0 && (
        <div className="text-sm text-slate-400">
          No cards match "{filter}".
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 auto-rows-min">
        {filtered.map((it, idx) => (
          <CardRow
            key={it.id}
            item={it}
            index={idx}
            kuLabel={kuTitleById(it.knowledge_unit)}
          />
        ))}
      </div>
    </div>
  );
}

// ----- Tile -----

function Tile({
  label,
  value,
  sub,
  onClick,
  disabled,
  accent = "default",
}: {
  label: string;
  value: number | string;
  sub?: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: "default" | "emerald";
}) {
  const accentClass =
    accent === "emerald"
      ? "border-emerald-700/50 bg-emerald-950/30 hover:border-emerald-500 hover:bg-emerald-900/30"
      : "border-slate-800 bg-slate-900 hover:border-slate-600 hover:bg-slate-800/70";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-4 py-4 text-left transition ${accentClass} disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </button>
  );
}

// ----- KU bulk generate button (header of KU modal) -----

function KUGenerateButton({
  sectionId,
  kus,
}: {
  sectionId: number;
  kus: { id: number; study_items_count: number }[];
}) {
  const generateAll = useGenerateSectionItems(sectionId);
  const kusWithoutCard = kus.filter((k) => k.study_items_count === 0).length;
  if (kus.length === 0) return null;
  return (
    <Button
      className="!px-2 !py-1 text-xs"
      onClick={() => generateAll.mutate({ regenerate: false })}
      disabled={generateAll.isPending || kusWithoutCard === 0}
      title={
        kusWithoutCard === 0
          ? "All KUs have cards"
          : `Generate cards for ${kusWithoutCard} KU(s)`
      }
    >
      {generateAll.isPending ? "…" : `Generate (${kusWithoutCard})`}
    </Button>
  );
}

// ----- Notes pane (full width, primary content) -----

function NotesPane({
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
  useEffect(() => {
    if (!synced) {
      setNotes(initialNotes);
      setSynced(true);
    }
  }, [initialNotes, synced]);

  const [ingestResult, setIngestResult] = useState<string | null>(null);
  const [enhanceResult, setEnhanceResult] = useState<
    { original: string; enhanced: string } | null
  >(null);
  const hasUnsavedNotes = synced && notes !== initialNotes;
  const hasKUs = (kus.data?.length ?? 0) > 0;

  async function saveNotes() {
    await updateSection.mutateAsync({ notes });
  }

  async function runEnhance(mode: "polish" | "expand") {
    if (!notes.trim()) return;
    setEnhanceResult(null);
    const res = await enhance.mutateAsync({ text: notes, mode });
    setEnhanceResult(res);
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
        <h2 className="text-lg font-medium">Notes</h2>
        {hasUnsavedNotes && (
          <span className="text-xs text-amber-400">Unsaved changes</span>
        )}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={Math.max(20, Math.min(40, (notes || "").split("\n").length + 4))}
        placeholder="Paste or write your notes here. Click Save to persist them. Click Ingest to turn them into knowledge units."
        spellCheck
        autoCorrect="on"
        autoCapitalize="sentences"
        className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-600 font-mono leading-relaxed"
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
          variant="secondary"
          onClick={() => runEnhance("polish")}
          disabled={enhance.isPending || !notes.trim()}
          title="Fix spelling/grammar/structure. Won't add new content. You review the diff before it applies."
        >
          {enhance.isPending ? "Working…" : "✨ Polish"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => runEnhance("expand")}
          disabled={enhance.isPending || !notes.trim()}
          title="Fill in missing detail. Adds definitions, sub-topics, structure for stubby notes. You review the diff before it applies."
        >
          {enhance.isPending ? "Working…" : "📚 Expand"}
        </Button>
        <Button
          onClick={runIngest}
          disabled={ingest.isPending || !notes.trim()}
        >
          {ingest.isPending ? "Ingesting…" : "Ingest notes → KUs"}
        </Button>
        {(ingest.isPending || enhance.isPending) && (
          <span className="text-xs text-slate-400 self-center">
            {enhance.isPending ? "10-25 sec" : "10-30 sec"}
          </span>
        )}
      </div>
      {ingest.error && (
        <ErrorText>{(ingest.error as Error).message}</ErrorText>
      )}
      {enhance.error && (
        <ErrorText>{(enhance.error as Error).message}</ErrorText>
      )}
      {ingestResult && (
        <div className="text-xs text-emerald-300">{ingestResult}</div>
      )}

      {enhanceResult && (
        <EnhanceMergeModal
          open
          onClose={() => setEnhanceResult(null)}
          original={enhanceResult.original}
          enhanced={enhanceResult.enhanced}
          onApply={(merged) => setNotes(merged)}
        />
      )}
    </Card>
  );
}
