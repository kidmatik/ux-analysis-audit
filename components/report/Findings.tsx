"use client";
import { useMemo, useState } from "react";
import { AnnotatedShot } from "../AnnotatedShot";
import { SeverityPill } from "../ui";
import { FINDING_CATEGORIES } from "@/lib/config";
import { sortFindings, type Finding, type Report } from "@/lib/report";
import { Locked, Label } from "./parts";

const SEVERITIES = ["critical", "high", "medium", "low"] as const;
const SEV_BORDER: Record<string, string> = {
  critical: "border-l-critical",
  high: "border-l-high",
  medium: "border-l-medium",
  low: "border-l-line-strong",
};

export function Findings({ findings, screenshots }: { findings: Finding[]; screenshots: Report["screenshots"] }) {
  const [category, setCategory] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");
  const visible = useMemo(
    () => sortFindings(findings).filter((f) => (category === "all" || f.category === category) && (severity === "all" || f.severity === severity)),
    [findings, category, severity],
  );
  const cats = FINDING_CATEGORIES.filter((c) => findings.some((f) => f.category === c.value));

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-4 sm:mx-0 bg-white/90 backdrop-blur px-4 sm:px-0 py-3 border-b border-line no-print">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          <Chip active={category === "all"} onClick={() => setCategory("all")}>All <Count n={findings.length} /></Chip>
          {cats.map((c) => (
            <Chip key={c.value} active={category === c.value} onClick={() => setCategory(c.value)}>
              {c.label} <Count n={findings.filter((f) => f.category === c.value).length} />
            </Chip>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-subtle mr-1">Severity</span>
          {(["all", ...SEVERITIES] as const).map((s) => {
            const n = s === "all" ? findings.length : findings.filter((f) => f.severity === s).length;
            if (s !== "all" && !n) return null;
            return (
              <button
                key={s}
                onClick={() => setSeverity(s)}
                className={`rounded-full px-3 py-1 capitalize transition-colors ${severity === s ? "bg-fg text-white" : "bg-surface text-muted hover:bg-surface-2"}`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 space-y-6">
        {visible.length === 0 && <p className="text-muted">No findings match these filters.</p>}
        {visible.map((f) => (
          <FindingCard key={f.id} f={f} shot={f.annotation ? screenshots[f.annotation.screenshotIndex] : undefined} />
        ))}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all ${active ? "border-accent bg-accent text-white shadow-sm" : "border-line-strong bg-white text-muted hover:border-accent/50 hover:text-fg"}`}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1 opacity-70 tabular-nums">{n}</span>;
}

function FindingCard({ f, shot }: { f: Finding; shot?: Report["screenshots"][number] }) {
  const cat = FINDING_CATEGORIES.find((c) => c.value === f.category)?.label;
  const locked = !f.problem;
  if (locked) {
    return (
      <div className={`fade-up rounded-2xl border border-line border-l-4 ${SEV_BORDER[f.severity]} bg-white p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center gap-3">
          <SeverityPill severity={f.severity} />
          <span className="text-sm text-subtle">{cat}</span>
        </div>
        <p className="mt-3 text-lg font-semibold">{f.title}</p>
        <div className="mt-4"><Locked text="Problem, business impact, fix and annotated screen are included in Pro." /></div>
      </div>
    );
  }
  return (
    <article id={`finding-${f.id}`} className={`fade-up scroll-mt-40 rounded-2xl border border-line border-l-4 ${SEV_BORDER[f.severity]} bg-white p-5 sm:p-8 shadow-sm`}>
      <div className="grid lg:grid-cols-[1fr_minmax(0,440px)] gap-6 lg:gap-10">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <SeverityPill severity={f.severity} />
            <span className="text-sm text-subtle">{cat} · {f.id}</span>
            <span className="text-sm text-subtle">Impact {f.impact}/5 · {f.effort} effort</span>
          </div>
          <h4 className="mt-3 text-xl sm:text-2xl font-bold tracking-tight leading-snug">{f.title}</h4>
          <Label>Problem</Label>
          <p className="text-base sm:text-[17px] leading-relaxed text-fg/85">{f.problem}</p>
          <div className="mt-2 grid sm:grid-cols-2 gap-5">
            <div>
              <Label>Why it matters</Label>
              <p className="leading-relaxed text-muted">{f.whyItMatters}</p>
            </div>
            <div>
              <Label>Business impact</Label>
              <p className="leading-relaxed text-muted">{f.businessImpact}</p>
            </div>
          </div>
          <div className="mt-6 rounded-xl bg-good/8 border border-good/25 p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-good">Recommended fix</p>
            {f.recommendedFix ? <p className="mt-1.5 leading-relaxed text-fg">{f.recommendedFix}</p> : <div className="mt-2"><Locked text="The recommended fix is included in Pro." /></div>}
          </div>
        </div>
        {shot?.src && f.annotation && (
          <figure className="lg:sticky lg:top-44 self-start">
            <AnnotatedShot src={shot.src} width={shot.width} height={shot.height} alt={shot.label} mode="focus" spotlight markers={[{ box: f.annotation, label: f.id.replace(/^F/, "") }]} />
            <figcaption className="mt-2.5 flex items-start gap-2 text-sm text-muted">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-critical" />
              <span><span className="font-medium text-fg">{f.annotationNote || "Highlighted area"}</span> · {shot.label}</span>
            </figcaption>
          </figure>
        )}
      </div>
    </article>
  );
}
