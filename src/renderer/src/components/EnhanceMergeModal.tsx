import { useEffect, useMemo, useState } from "react";
import { diffLines, type Change } from "diff";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useRewritePassage } from "../lib/api";
import { Button, MutationError } from "./ui";
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

const CONTEXT_CHARS = 500;

function contextBeforeOf(hunks: Hunk[], idx: number): string {
  for (let i = idx - 1; i >= 0; i--) {
    const h = hunks[i];
    if (h.kind === "unchanged") {
      return h.text.slice(-CONTEXT_CHARS);
    }
  }
  return "";
}

function contextAfterOf(hunks: Hunk[], idx: number): string {
  for (let i = idx + 1; i < hunks.length; i++) {
    const h = hunks[i];
    if (h.kind === "unchanged") {
      return h.text.slice(0, CONTEXT_CHARS);
    }
  }
  return "";
}

export function EnhanceMergeModal({
  open,
  onClose,
  original,
  enhanced,
  sectionId,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  original: string;
  enhanced: string;
  sectionId: number;
  onApply: (mergedText: string) => void;
}) {
  const changes = useMemo(() => diffLines(original, enhanced), [original, enhanced]);
  const initialHunks = useMemo(() => toHunks(changes), [changes]);
  const [hunks, setHunks] = useState<Hunk[]>(initialHunks);

  useEffect(() => {
    setHunks(initialHunks);
  }, [initialHunks]);

  function setAccepted(key: number, accepted: boolean) {
    setHunks((prev) =>
      prev.map((h) =>
        h.kind === "change" && h.key === key ? { ...h, accepted } : h,
      ),
    );
  }

  function setEnhancedText(key: number, newEnhanced: string) {
    setHunks((prev) =>
      prev.map((h) =>
        h.kind === "change" && h.key === key
          ? { ...h, enhanced: newEnhanced, accepted: true }
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
            Each block previews how it will look. Use <b>✓ Accept</b> /{" "}
            <b>✗ Reject</b> to choose, or <b>🔄 Regenerate</b> to rewrite a block
            with custom guidance.
          </div>
          {hunks.map((h, idx) =>
            h.kind === "unchanged" ? (
              <UnchangedPart key={h.key} text={h.text} />
            ) : (
              <ChangeHunk
                key={h.key}
                hunk={h}
                sectionId={sectionId}
                contextBefore={contextBeforeOf(hunks, idx)}
                contextAfter={contextAfterOf(hunks, idx)}
                onAccept={() => setAccepted(h.key, true)}
                onReject={() => setAccepted(h.key, false)}
                onRegenerated={(text) => setEnhancedText(h.key, text)}
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
  const visibleLines = showFull
    ? lines
    : [
        ...lines.slice(0, 2),
        `… (${lines.length - 2} more lines unchanged)`,
      ];
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

const QUICK_INSTRUCTIONS = [
  "Make this shorter",
  "Add an example",
  "Simplify the language",
  "Convert to bullet list",
];

function ChangeHunk({
  hunk,
  sectionId,
  contextBefore,
  contextAfter,
  onAccept,
  onReject,
  onRegenerated,
}: {
  hunk: Extract<Hunk, { kind: "change" }>;
  sectionId: number;
  contextBefore: string;
  contextAfter: string;
  onAccept: () => void;
  onReject: () => void;
  onRegenerated: (newEnhanced: string) => void;
}) {
  const accepted = hunk.accepted;
  const [regenOpen, setRegenOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const rewrite = useRewritePassage(sectionId);

  async function submitRegen(instr?: string) {
    const effective = (instr ?? instruction).trim();
    if (!effective) return;
    const res = await rewrite.mutateAsync({
      original: hunk.original,
      previous: hunk.enhanced,
      instruction: effective,
      context_before: contextBefore,
      context_after: contextAfter,
    });
    onRegenerated(res.rewritten);
    setRegenOpen(false);
    setInstruction("");
  }

  return (
    <div
      className={
        "rounded-lg border " +
        (accepted
          ? "border-emerald-700/60 bg-emerald-950/10"
          : "border-rose-800/40 bg-rose-950/10")
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
        <Side
          label="Your original"
          tone={accepted ? "muted" : "active-removed"}
          markdown={hunk.original}
        />
        <Side
          label="AI version"
          tone={accepted ? "active-added" : "muted"}
          markdown={hunk.enhanced}
        />
      </div>
      <div className="border-t border-slate-800 px-3 py-2 flex items-center gap-2 text-xs flex-wrap">
        <span className="text-slate-400">
          {accepted ? "Using AI version" : "Keeping your original"}
        </span>
        <div className="ml-auto flex gap-1">
          <button
            onClick={onAccept}
            disabled={accepted}
            className={
              "inline-flex items-center gap-1 rounded px-2 py-1 transition " +
              (accepted
                ? "bg-emerald-700 text-white cursor-default"
                : "bg-slate-800 text-slate-200 hover:bg-emerald-700 hover:text-white")
            }
            title="Use AI version"
          >
            ✓ Accept
          </button>
          <button
            onClick={onReject}
            disabled={!accepted}
            className={
              "inline-flex items-center gap-1 rounded px-2 py-1 transition " +
              (!accepted
                ? "bg-rose-700 text-white cursor-default"
                : "bg-slate-800 text-slate-200 hover:bg-rose-700 hover:text-white")
            }
            title="Keep your original"
          >
            ✗ Reject
          </button>
          <button
            onClick={() => setRegenOpen((v) => !v)}
            disabled={rewrite.isPending}
            className="inline-flex items-center gap-1 rounded px-2 py-1 bg-slate-800 text-slate-200 hover:bg-slate-700 transition disabled:opacity-50"
            title="Regenerate with a custom instruction"
          >
            🔄 Regenerate
          </button>
        </div>
      </div>

      {regenOpen && (
        <div className="border-t border-slate-800 px-3 py-3 bg-slate-950/40 space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            How should Claude rewrite this block?
          </div>
          <textarea
            autoFocus
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. 'shorter', 'add a real-world example', 'rewrite as a bulleted list'"
            rows={2}
            className="w-full rounded bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-600"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submitRegen();
              }
            }}
          />
          <div className="flex flex-wrap gap-1">
            {QUICK_INSTRUCTIONS.map((q) => (
              <button
                key={q}
                onClick={() => submitRegen(q)}
                disabled={rewrite.isPending}
                className="rounded-full bg-slate-900 border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="!px-2 !py-1 text-xs"
              onClick={() => submitRegen()}
              disabled={rewrite.isPending || !instruction.trim()}
            >
              {rewrite.isPending ? "Rewriting…" : "Rewrite (Ctrl+Enter)"}
            </Button>
            <Button
              className="!px-2 !py-1 text-xs"
              variant="ghost"
              onClick={() => {
                setRegenOpen(false);
                setInstruction("");
              }}
              disabled={rewrite.isPending}
            >
              Cancel
            </Button>
            <MutationError mutation={rewrite} />
          </div>
        </div>
      )}
    </div>
  );
}

// ----- Side rendering -----

type SideTone = "active-added" | "active-removed" | "muted";

const SIDE_TONE: Record<SideTone, { bg: string; label: string; muted: boolean }> = {
  "active-added":   { bg: "bg-emerald-950/20", label: "text-emerald-300", muted: false },
  "active-removed": { bg: "bg-rose-950/20",    label: "text-rose-300",    muted: false },
  "muted":          { bg: "bg-slate-950/30",   label: "text-slate-500",   muted: true  },
};

function Side({
  label,
  tone,
  markdown,
}: {
  label: string;
  tone: SideTone;
  markdown: string;
}) {
  const t = SIDE_TONE[tone];
  return (
    <div className={`p-3 ${t.bg} ${t.muted ? "opacity-60" : ""}`}>
      <div className={`text-[10px] uppercase tracking-wide mb-1 ${t.label}`}>
        {label}
      </div>
      {markdown.trim() ? (
        <div className="notes-view text-[13px] !max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
      ) : (
        <div className="text-xs text-slate-600 italic">(empty)</div>
      )}
    </div>
  );
}
