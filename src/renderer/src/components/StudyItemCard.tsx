import { useState } from "react";

import type { Distractor, StudyItem } from "../lib/types";
import { MODE_LABELS } from "../lib/types";
import { Button } from "./ui";

type Props = {
  item: StudyItem;
  onDelete?: () => void;
};

export function StudyItemCard({ item, onDelete }: Props) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="rounded bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 text-emerald-300">
          {MODE_LABELS[item.mode]}
        </span>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
          {item.blooms_level}
        </span>
        {onDelete && (
          <Button
            variant="ghost"
            className="ml-auto !px-1.5 !py-0.5 text-xs"
            onClick={() => {
              if (confirm("Delete this study item?")) onDelete();
            }}
          >
            ✕
          </Button>
        )}
      </div>

      <div className="text-sm text-slate-100 whitespace-pre-wrap">
        {item.prompt}
      </div>

      {!revealed ? (
        <Button
          variant="secondary"
          className="text-xs"
          onClick={() => setRevealed(true)}
        >
          Show answer
        </Button>
      ) : (
        <AnswerDisplay item={item} />
      )}
    </div>
  );
}

function AnswerDisplay({ item }: { item: StudyItem }) {
  const ea = item.expected_answer as Record<string, unknown>;
  switch (item.mode) {
    case "flashcard":
      return (
        <div className="text-sm space-y-1">
          <div>
            <span className="text-slate-400 text-xs">Answer:</span>{" "}
            <span className="text-slate-100">{String(ea.answer ?? "")}</span>
          </div>
          {ea.explanation ? (
            <div className="text-xs text-slate-400">
              {String(ea.explanation)}
            </div>
          ) : null}
        </div>
      );
    case "mc":
      return (
        <div className="text-sm space-y-2">
          <div>
            <span className="text-slate-400 text-xs">Correct:</span>{" "}
            <span className="text-emerald-300">{String(ea.answer ?? "")}</span>
          </div>
          {ea.explanation ? (
            <div className="text-xs text-slate-400">
              {String(ea.explanation)}
            </div>
          ) : null}
          {item.distractors.length > 0 && (
            <ul className="text-xs space-y-1 pl-2">
              {item.distractors.map((d: Distractor, i) => (
                <li key={i}>
                  <span className="text-rose-300">✗ {d.text}</span>
                  <span className="text-slate-500"> — {d.why_wrong}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    case "scenario": {
      const expected = (ea.expected_concepts as string[]) ?? [];
      return (
        <div className="text-sm space-y-1">
          <div>
            <span className="text-slate-400 text-xs">Answer:</span>{" "}
            <span className="text-slate-100">{String(ea.answer ?? "")}</span>
          </div>
          {ea.rationale ? (
            <div className="text-xs text-slate-400">
              {String(ea.rationale)}
            </div>
          ) : null}
          {expected.length > 0 && (
            <div className="text-xs text-slate-400">
              Should mention: {expected.join(", ")}
            </div>
          )}
        </div>
      );
    }
    case "fill_blank": {
      const acceptable = (ea.acceptable_answers as string[]) ?? [];
      return (
        <div className="text-sm space-y-1">
          <div>
            <span className="text-slate-400 text-xs">Accepts:</span>{" "}
            <span className="text-slate-100">{acceptable.join(" / ")}</span>
          </div>
          {ea.explanation ? (
            <div className="text-xs text-slate-400">
              {String(ea.explanation)}
            </div>
          ) : null}
        </div>
      );
    }
    case "free_response": {
      const expected = (ea.expected_concepts as string[]) ?? [];
      return (
        <div className="text-sm space-y-1">
          <div className="text-slate-100 whitespace-pre-wrap">
            {String(ea.model_answer ?? "")}
          </div>
          {expected.length > 0 && (
            <div className="text-xs text-slate-400 mt-1">
              Should mention: {expected.join(", ")}
            </div>
          )}
        </div>
      );
    }
    default:
      return null;
  }
}
