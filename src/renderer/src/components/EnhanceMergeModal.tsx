import { useMemo, useState } from "react";
import { diffLines, type Change } from "diff";

import { Button } from "./ui";
import { Modal } from "./Modal";

type Hunk =
  | { kind: "unchanged"; text: string; key: number }
  | {
      kind: "change";
      original: string;
      enhanced: string;
      accepted: boolean;
      key: number;
    };

function toHunks(changes: Change[]): Hunk[] {
  const out: Hunk[] = [];
  let key = 0;
  let i = 0;
  while (i < changes.length) {
    const c = changes[i];
    if (!c.added && !c.removed) {
      out.push({ kind: "unchanged", text: c.value, key: key++ });
      i++;
      continue;
    }
    // Coalesce consecutive removed/added entries into one hunk.
    let original = "";
    let enhanced = "";
    while (i < changes.length && (changes[i].added || changes[i].removed)) {
      if (changes[i].removed) original += changes[i].value;
      if (changes[i].added) enhanced += changes[i].value;
      i++;
    }
    out.push({
      kind: "change",
      original,
      enhanced,
      accepted: true,
      key: key++,
    });
  }
  return out;
}

function rebuild(hunks: Hunk[]): string {
  return hunks
    .map((h) =>
      h.kind === "unchanged" ? h.text : h.accepted ? h.enhanced : h.original,
    )
    .join("");
}

export function EnhanceMergeModal({
  open,
  onClose,
  original,
  enhanced,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  original: string;
  enhanced: string;
  onApply: (mergedText: string) => void;
}) {
  const changes = useMemo(() => diffLines(original, enhanced), [original, enhanced]);
  const initialHunks = useMemo(() => toHunks(changes), [changes]);
  const [hunks, setHunks] = useState<Hunk[]>(initialHunks);

  // Reset hunks when input changes (modal reopened with new diff).
  useMemo(() => setHunks(initialHunks), [initialHunks]);

  function toggleHunk(key: number) {
    setHunks((prev) =>
      prev.map((h) =>
        h.kind === "change" && h.key === key
          ? { ...h, accepted: !h.accepted }
          : h,
      ),
    );
  }

  function acceptAll() {
    setHunks((prev) =>
      prev.map((h) => (h.kind === "change" ? { ...h, accepted: true } : h)),
    );
  }

  function rejectAll() {
    setHunks((prev) =>
      prev.map((h) => (h.kind === "change" ? { ...h, accepted: false } : h)),
    );
  }

  const changeCount = hunks.filter((h) => h.kind === "change").length;
  const acceptedCount = hunks.filter(
    (h) => h.kind === "change" && h.accepted,
  ).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Review AI enhancements — ${acceptedCount} of ${changeCount} accepted`}
      rightActions={
        <>
          <Button
            className="!px-2 !py-1 text-xs"
            variant="ghost"
            onClick={rejectAll}
            disabled={acceptedCount === 0}
          >
            Reject all
          </Button>
          <Button
            className="!px-2 !py-1 text-xs"
            variant="secondary"
            onClick={acceptAll}
            disabled={acceptedCount === changeCount}
          >
            Accept all
          </Button>
          <Button
            className="!px-2 !py-1 text-xs"
            onClick={() => {
              onApply(rebuild(hunks));
              onClose();
            }}
          >
            Apply ({acceptedCount})
          </Button>
        </>
      }
    >
      {changeCount === 0 ? (
        <div className="text-sm text-slate-400">
          The AI returned the same text — nothing to merge.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-slate-400">
            Click a hunk to toggle accept/reject. <b>Accepted</b> hunks use the
            AI version; <b>rejected</b> hunks keep your original.
          </div>
          {hunks.map((h) =>
            h.kind === "unchanged" ? (
              <UnchangedPart key={h.key} text={h.text} />
            ) : (
              <ChangeHunk
                key={h.key}
                hunk={h}
                onToggle={() => toggleHunk(h.key)}
              />
            ),
          )}
        </div>
      )}
    </Modal>
  );
}

// ----- Unchanged sections (collapsed by default if long) -----

function UnchangedPart({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const lines = text.split("\n").filter(Boolean);
  if (lines.length === 0) return null;
  const showFull = lines.length <= 3 || open;
  const visibleLines = showFull ? lines : [...lines.slice(0, 2), `… (${lines.length - 2} more lines unchanged)`];
  return (
    <div
      onClick={() => !showFull && setOpen(true)}
      className={
        "rounded border border-slate-800/60 bg-slate-950/30 p-2 text-xs text-slate-500 font-mono whitespace-pre-wrap " +
        (!showFull ? "cursor-pointer hover:bg-slate-900/40" : "")
      }
    >
      {visibleLines.join("\n")}
    </div>
  );
}

// ----- Change hunks -----

function ChangeHunk({
  hunk,
  onToggle,
}: {
  hunk: Extract<Hunk, { kind: "change" }>;
  onToggle: () => void;
}) {
  const accepted = hunk.accepted;
  return (
    <div
      className={
        "rounded-lg border " +
        (accepted
          ? "border-emerald-700/60 bg-emerald-950/10"
          : "border-slate-700 bg-slate-950/40 opacity-70")
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
        <Side
          label="Your original"
          tone={accepted ? "muted" : "active"}
          text={hunk.original}
          variant="removed"
        />
        <Side
          label="AI enhancement"
          tone={accepted ? "active" : "muted"}
          text={hunk.enhanced}
          variant="added"
        />
      </div>
      <div className="border-t border-slate-800 px-3 py-2 flex items-center gap-2 text-xs">
        <span className="text-slate-400">
          {accepted ? "Using AI version" : "Keeping original"}
        </span>
        <Button
          className="!px-2 !py-1 text-xs ml-auto"
          variant={accepted ? "secondary" : "primary"}
          onClick={onToggle}
        >
          {accepted ? "Keep original" : "Use AI"}
        </Button>
      </div>
    </div>
  );
}

function Side({
  label,
  tone,
  text,
  variant,
}: {
  label: string;
  tone: "active" | "muted";
  text: string;
  variant: "added" | "removed";
}) {
  const bg =
    tone === "muted"
      ? "bg-slate-950/30 text-slate-500"
      : variant === "added"
        ? "bg-emerald-950/20 text-emerald-200"
        : "bg-rose-950/20 text-rose-200";
  return (
    <div className={`p-3 ${bg}`}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
        {label}
      </div>
      <pre className="whitespace-pre-wrap text-xs font-mono leading-relaxed">
        {text || <span className="text-slate-600">(empty)</span>}
      </pre>
    </div>
  );
}
