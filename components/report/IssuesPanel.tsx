"use client";
import { useEffect, useState } from "react";
import { Findings } from "./Findings";
import { Locked } from "./parts";
import type { Finding, Report } from "@/lib/report";
import { VISIBILITY_SUB_SCORES, type VisibilityCheck, type VisibilityReport } from "@/lib/visibility";

// The Issues tab: UX & UI findings and AI & search visibility issues, one pillar at a time.
export function IssuesPanel({ findings, screenshots, visibility }: { findings: Finding[]; screenshots: Report["screenshots"]; visibility?: VisibilityReport | null }) {
  const [pillar, setPillar] = useState<"ux" | "visibility">("ux");
  const open = visibility?.checks.filter((c) => c.status !== "pass") ?? [];

  useEffect(() => {
    const sync = () => {
      const h = window.location.hash.slice(1);
      if (h.startsWith("check-")) setPillar("visibility");
      else if (h.startsWith("finding-")) setPillar("ux");
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <div>
      <div className="inline-flex rounded-xl bg-surface-2 p-1">
        {([
          ["ux", "UX & UI", findings.length],
          ["visibility", "AI & Search", visibility ? open.length : null],
        ] as const).map(([k, label, n]) => (
          <button
            key={k}
            onClick={() => setPillar(k)}
            aria-pressed={pillar === k}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${pillar === k ? "bg-white text-fg shadow-sm" : "text-muted hover:text-fg"}`}
          >
            {label}
            {n != null && <span className="ml-1.5 text-subtle tabular-nums">{n}</span>}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {pillar === "ux" ? (
          <Findings findings={findings} screenshots={screenshots} />
        ) : visibility ? (
          <VisibilityIssues v={visibility} />
        ) : (
          <NoVisibility />
        )}
      </div>
    </div>
  );
}

export function NoVisibility() {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center">
      <p className="text-lg font-semibold">AI & search visibility needs a public URL</p>
      <p className="mx-auto mt-2 max-w-lg text-muted">This audit was run from designs or uploads. Run an audit with a live URL to check crawlability, AI crawler access, metadata and structured data.</p>
    </div>
  );
}

const GROUPS = [
  { key: "errors", title: "Errors", match: (c: VisibilityCheck) => c.status === "fail", dot: "bg-critical" },
  { key: "warnings", title: "Warnings", match: (c: VisibilityCheck) => c.status === "warn", dot: "bg-high" },
] as const;

function VisibilityIssues({ v }: { v: VisibilityReport }) {
  const [openFix, setOpenFix] = useState<string | null>(null);
  const [showPassed, setShowPassed] = useState(false);
  const [track, setTrack] = useState<"all" | "seo" | "geo">("all");
  const inTrack = (c: VisibilityCheck) => track === "all" || c.track === track;
  const passed = v.checks.filter((c) => c.status === "pass" && inTrack(c));
  const openCount = (t: "seo" | "geo" | "all") => v.checks.filter((c) => c.status !== "pass" && (t === "all" || c.track === t)).length;
  const groupLabel = (k: string) => VISIBILITY_SUB_SCORES.find((g) => g.key === k)?.label ?? k;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        {([
          ["all", "All"],
          ["seo", "SEO · search engines"],
          ["geo", "GEO · AI answer engines"],
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTrack(k)}
            aria-pressed={track === k}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${track === k ? "border-accent bg-accent text-white" : "border-line bg-white text-muted hover:border-line-strong hover:text-fg"}`}
          >
            {l} <span className="opacity-70 tabular-nums">{openCount(k)}</span>
          </button>
        ))}
      </div>
      {GROUPS.map((g) => {
        const items = v.checks.filter((c) => g.match(c) && inTrack(c));
        if (!items.length) return null;
        return (
          <section key={g.key} className="rounded-2xl border border-line bg-white shadow-sm">
            <h3 className="flex items-center gap-2 px-5 sm:px-7 pt-5 pb-3 text-xl font-semibold">
              <span className={`h-2.5 w-2.5 rounded-full ${g.dot}`} />
              {g.title} ({items.length})
            </h3>
            <ul className="divide-y divide-line">
              {items.map((c) => (
                <li key={c.id} id={`check-${c.id}`} className="scroll-mt-64 px-5 sm:px-7 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[17px] leading-snug">
                        <StatusIcon status={c.status} />
                        <span className="font-medium">{c.label}</span>
                        {c.pages.length > 0 && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "fail" ? "bg-critical/10 text-critical" : "bg-high/10 text-high"}`}>
                            {c.pages.length} {c.pages.length === 1 ? "page" : "pages"} affected
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-muted">{c.detail}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-subtle">
                        <TrackTag track={c.track} />
                        {groupLabel(c.group)} · {c.severity} priority
                      </p>
                    </div>
                    <button
                      onClick={() => setOpenFix(openFix === c.id ? null : c.id)}
                      aria-expanded={openFix === c.id}
                      className="shrink-0 self-start sm:self-center text-[15px] font-semibold text-accent hover:underline underline-offset-4"
                    >
                      {openFix === c.id ? "Hide fix" : "How to fix it"}
                    </button>
                  </div>
                  {openFix === c.id && (
                    <div className="fade-up mt-4 rounded-2xl border-2 border-[#14b8a6] bg-[#14b8a6]/5 p-5">
                      <p className="text-lg font-semibold">How to fix it</p>
                      {c.fix ? <p className="mt-2 leading-relaxed">{c.fix}</p> : <div className="mt-3"><Locked text="Step-by-step fixes are included in Pro." /></div>}
                      {c.pages.length > 0 && (
                        <details className="mt-3 text-sm">
                          <summary className="cursor-pointer text-muted">Affected pages</summary>
                          <ul className="mt-2 space-y-1">
                            {c.pages.map((p) => <li key={p} className="truncate text-muted">{p}</li>)}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {passed.length > 0 && (
        <section className="rounded-2xl border border-line bg-white shadow-sm">
          <button onClick={() => setShowPassed(!showPassed)} aria-expanded={showPassed} className="flex w-full items-center justify-between px-5 sm:px-7 py-5 text-left text-xl font-semibold">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-good" />Passed checks ({passed.length})</span>
            <span className="text-sm font-semibold text-accent">{showPassed ? "Hide" : "Show"}</span>
          </button>
          {showPassed && (
            <ul className="divide-y divide-line border-t border-line">
              {passed.map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-5 sm:px-7 py-3">
                  <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-good" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 10.5l3.2 3.2L15 7" /></svg>
                  <div><p className="font-medium">{c.label}</p><p className="text-sm text-muted">{c.detail}</p></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

export function TrackTag({ track }: { track: "seo" | "geo" }) {
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${track === "geo" ? "bg-[#14b8a6]/12 text-[#0f766e]" : "bg-medium/10 text-medium"}`}>
      {track === "geo" ? "GEO" : "SEO"}
    </span>
  );
}

function StatusIcon({ status }: { status: "pass" | "warn" | "fail" }) {
  if (status === "fail")
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-critical text-white" aria-label="Failed">
        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 6l8 8M14 6l-8 8" /></svg>
      </span>
    );
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-high text-xs font-bold text-white" aria-label="Warning">!</span>
  );
}
