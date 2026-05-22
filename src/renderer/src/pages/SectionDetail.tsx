import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  useGenerateSectionItems,
  useKnowledgeUnits,
  useSection,
  useSectionStudyItems,
} from "../lib/api";
import type { Section } from "../lib/types";
import { Button, ErrorText, Spinner } from "../components/ui";
import { KURow } from "../components/KURow";
import { CardRow } from "../components/CardRow";
import { Modal } from "../components/Modal";
import { NotesPane } from "../components/NotesPane";

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
      <SectionNavBar
        courseId={courseId ?? ""}
        section={section.data}
        kuCount={kuCount}
        cardCount={cardCount}
        onOpenKUs={() => setPanel("kus")}
        onOpenCards={() => setPanel("cards")}
        onStartReview={() =>
          cardCount > 0 &&
          navigate(`/courses/${courseId}/sections/${id}/review`)
        }
      />

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

// ----- Section nav bar (sticky, replaces the old tile row) -----

function SectionNavBar({
  courseId,
  section,
  kuCount,
  cardCount,
  onOpenKUs,
  onOpenCards,
  onStartReview,
}: {
  courseId: string;
  section: Section;
  kuCount: number;
  cardCount: number;
  onOpenKUs: () => void;
  onOpenCards: () => void;
  onStartReview: () => void;
}) {
  return (
    <div className="no-print sticky top-0 z-30 -mx-6 px-6 py-3 bg-slate-950/95 backdrop-blur border-b border-slate-800">
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          to={`/courses/${courseId}`}
          className="inline-flex items-center text-sm text-slate-400 hover:text-slate-100 shrink-0"
          title="Back to course"
        >
          ← Course
        </Link>
        <div className="hidden sm:block h-5 w-px bg-slate-700 shrink-0" />
        <h1 className="min-w-0 flex-1 truncate text-base sm:text-lg font-semibold">
          {section.title}
          <span className="ml-2 text-xs text-slate-500 font-normal">
            · difficulty {section.difficulty}
          </span>
        </h1>
        <NavBtn label="KUs" count={kuCount} onClick={onOpenKUs} />
        <NavBtn label="Cards" count={cardCount} onClick={onOpenCards} />
        <Button
          variant="primary"
          disabled={cardCount === 0}
          onClick={onStartReview}
          className="shrink-0"
          title={cardCount > 0 ? `Review ${cardCount} cards` : "No cards yet"}
        >
          ▶ Review{cardCount > 0 ? ` (${cardCount})` : ""}
        </Button>
      </div>
    </div>
  );
}

function NavBtn({
  label,
  count,
  onClick,
}: {
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition shrink-0"
      title={`${count} ${label.toLowerCase()}`}
    >
      <span>{label}</span>
      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-slate-400">
        {count}
      </span>
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

