import { useEffect, useState } from "react";

type Health = { ok: boolean; db?: boolean; error?: string };
type Status = "checking" | "ok" | "error";

export default function App() {
  const [status, setStatus] = useState<Status>("checking");
  const [detail, setDetail] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/health/");
        const body: Health = await res.json();
        if (cancelled) return;
        if (body.ok && body.db) {
          setStatus("ok");
          setDetail("Backend and database reachable.");
        } else {
          setStatus("error");
          setDetail(body.error ?? "Backend reachable but database is not.");
        }
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setDetail(err instanceof Error ? err.message : String(err));
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
      <div className="max-w-md text-center space-y-4 p-8">
        <h1 className="text-3xl font-semibold">Personal LMS</h1>
        <div
          className={
            "rounded-lg border p-4 " +
            (status === "ok"
              ? "border-emerald-700 bg-emerald-950/40"
              : status === "error"
                ? "border-rose-700 bg-rose-950/40"
                : "border-slate-700 bg-slate-900")
          }
        >
          <div className="font-medium">
            {status === "checking" && "Connecting to backend…"}
            {status === "ok" && "Connected to backend"}
            {status === "error" && "Backend connection failed"}
          </div>
          {detail && (
            <div className="mt-2 text-sm text-slate-400">{detail}</div>
          )}
        </div>
      </div>
    </div>
  );
}
