"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PROCESSING_STAGES } from "@/lib/config";
import { Button, ButtonLink } from "./ui";

export function Processing({ id, productName, initial }: { id: string; productName: string; initial: { status: string; stage: number; error: string | null } }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (state.status === "complete") {
      const t = setTimeout(() => router.replace(`/audits/${id}`), 700);
      return () => clearTimeout(t);
    }
    if (state.status === "failed") return;
    const poll = setInterval(async () => {
      const res = await fetch(`/api/audits/${id}`, { cache: "no-store" });
      if (res.ok) setState(await res.json());
    }, 1500);
    const tick = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [id, state.status, router]);

  async function retry() {
    await fetch(`/api/audits/${id}/retry`, { method: "POST" });
    setState({ status: "queued", stage: 0, error: null });
  }

  const stage = state.status === "complete" ? PROCESSING_STAGES.length : state.stage;
  const pct = state.status === "complete" ? 100 : Math.min(96, (stage / PROCESSING_STAGES.length) * 100 + 6);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-14 sm:py-24">
      <p className="text-[11px] uppercase tracking-[0.18em] text-accent">Audit in progress</p>
      <h1 className="mt-4 font-display text-3xl sm:text-5xl tracking-tight">{productName}</h1>
      <p className="mt-3 text-muted">
        {state.status === "failed" ? "The audit could not be completed." : state.status === "complete" ? "Your report is ready." : "We are analyzing your product. This usually takes one to three minutes."}
      </p>

      <div className="mt-10 h-1 rounded bg-line overflow-hidden relative">
        <div className={`h-1 bg-accent transition-all duration-700 relative ${state.status === "failed" ? "bg-critical" : ""}`} style={{ width: `${pct}%` }} />
      </div>

      <ol className="mt-10 space-y-1">
        {PROCESSING_STAGES.map((label, i) => {
          const done = i < stage;
          const active = i === stage && state.status !== "failed" && state.status !== "complete";
          const failed = i === stage && state.status === "failed";
          return (
            <li key={label} className={`flex items-center gap-4 rounded-md px-4 py-3.5 ${active ? "bg-surface border border-line" : "border border-transparent"}`}>
              <span className="relative flex h-5 w-5 items-center justify-center">
                {done ? (
                  <svg viewBox="0 0 20 20" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="9" /><path d="M6 10.5l2.5 2.5L14 7.5" /></svg>
                ) : active ? (
                  <span className="h-3 w-3 rounded-full bg-accent pulse-ring" />
                ) : failed ? (
                  <span className="h-3 w-3 rounded-full bg-critical" />
                ) : (
                  <span className="h-3 w-3 rounded-full border border-line-strong" />
                )}
              </span>
              <span className={`text-[15px] ${done ? "text-muted" : active ? "text-fg" : "text-subtle"}`}>{label}</span>
              {active && (
                <span className="ml-auto relative h-1 w-24 overflow-hidden rounded bg-line shimmer" />
              )}
            </li>
          );
        })}
      </ol>

      {state.status === "failed" && (
        <div className="mt-8 rounded-md border border-critical/40 bg-critical/5 p-5">
          <p className="text-sm">{state.error}</p>
          <div className="mt-4 flex gap-3">
            <Button onClick={retry}>Retry audit</Button>
            <ButtonLink href="/audits/new" variant="secondary">Start a new audit</ButtonLink>
          </div>
        </div>
      )}
      {state.status !== "failed" && state.status !== "complete" && (
        <p className="mt-8 text-xs text-subtle">{elapsed}s elapsed. You can leave this page; the audit will appear on your dashboard when it is ready.</p>
      )}
    </div>
  );
}
