import type { ModeCount } from "../lib/types";
import { MODE_LABELS } from "../lib/types";

export function StatTile({
  label,
  value,
  sub,
  accent = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "default" | "good" | "warn" | "bad";
}) {
  const accentClass = {
    default: "text-slate-100",
    good: "text-emerald-300",
    warn: "text-amber-300",
    bad: "text-rose-300",
  }[accent];
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/60 px-4 py-3">
      <div className={`text-2xl font-semibold ${accentClass}`}>{value}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

const MODE_COLORS: Record<string, string> = {
  flashcard: "bg-emerald-500",
  mc: "bg-sky-500",
  scenario: "bg-violet-500",
  fill_blank: "bg-amber-500",
  free_response: "bg-rose-500",
};

export function ModeBar({
  distribution,
  showLegend = true,
}: {
  distribution: ModeCount[];
  showLegend?: boolean;
}) {
  const total = distribution.reduce((s, m) => s + m.count, 0);
  if (total === 0) {
    return (
      <div className="text-xs text-slate-500">No reviews in the last 7 days.</div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
        {distribution.map((m) => (
          <div
            key={m.mode}
            className={MODE_COLORS[m.mode] ?? "bg-slate-500"}
            style={{ width: `${m.pct}%` }}
            title={`${MODE_LABELS[m.mode] ?? m.mode}: ${m.count} (${m.pct}%)`}
          />
        ))}
      </div>
      {showLegend && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
          {distribution.map((m) => (
            <div key={m.mode} className="flex items-center gap-1">
              <span
                className={`inline-block h-2 w-2 rounded-sm ${
                  MODE_COLORS[m.mode] ?? "bg-slate-500"
                }`}
              />
              <span>
                {MODE_LABELS[m.mode] ?? m.mode}{" "}
                <span className="text-slate-500">{m.pct}%</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MasteryProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
      <div
        className={
          "h-full transition-all " +
          (pct >= 80
            ? "bg-emerald-500"
            : pct >= 50
              ? "bg-amber-500"
              : "bg-rose-500")
        }
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}
