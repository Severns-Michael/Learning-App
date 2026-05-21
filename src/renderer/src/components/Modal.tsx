import { useEffect } from "react";
import type { ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  rightActions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  rightActions?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 px-2 py-1 rounded hover:bg-slate-800"
            title="Close (Esc)"
          >
            ← Back
          </button>
          <h2 className="text-lg font-medium">{title}</h2>
        </div>
        <div className="flex items-center gap-2">{rightActions}</div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
