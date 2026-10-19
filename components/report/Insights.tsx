"use client";
import { useEffect, useMemo, useState } from "react";
import { Locked } from "./parts";
import { PanelTitle } from "./PanelTitle";
import { SUB_SCORES, computeGrowthScore, type Finding, type SubScoreKey } from "@/lib/report";
import { VISIBILITY_SUB_SCORES, overallScore, visibilityScore, type VisibilityKey, type VisibilityReport } from "@/lib/visibility";

type Effort = "low" | "medium" | "high";
type Task = {
  id: string;
  href: string;
  pillar: "ux" | "visibility";
  track?: "seo" | "geo";
  goal: string; // sub-score key
  title: string;
  fix: string;
  severity: string;
  impact: number; // 1-5
  effort: Effort;
  gain: number; // estimated sub-score points
};

// Which UX sub-score each finding category mostly moves.
const CATEGORY_GOAL: Record<Finding["category"], SubScoreKey> = {
  messaging: "value_proposition",
  onboarding: "onboarding",
  core_flow: "conversion",
  dashboard: "cognitive_load",
  heuristics: "hierarchy",
  strategic_risks: "trust",
};

// The job each criterion does for the people using the product.
const JOBS: Record<string, string> = {
  value_proposition: "When a buyer lands on the page, they understand within five seconds what changes for them and why it matters.",
  onboarding: "When a new user signs up, they reach their first real result without help or guesswork.",
  conversion: "When someone is ready to act, the next step is obvious, close and low-risk.",
  cognitive_load: "When a user opens the product, they see only what they need for the task at hand.",
  hierarchy: "When people scan a screen, the most important thing is the first thing they read.",
  trust: "When a buyer evaluates the product, they find proof that it works for teams like theirs.",
  crawlability: "When search engines visit, every important page can be found, fetched and indexed.",
  ai_access: "When someone asks ChatGPT, Claude, Perplexity or Gemini about your category, your pages can be read and cited.",
  metadata: "When your page appears in search or a shared link, its title and description make people click.",
  structured_data: "When engines and AI assistants read your pages, they understand what your company and product are.",
  content: "When a page is read by a person or a model, its headings and copy explain it clearly.",
  performance: "When a visitor opens a page, it loads before they lose interest.",
};

const SEV_PENALTY: Record<string, number> = { critical: 45, high: 25, medium: 12, low: 5 };
const EFFORT_OF: Record<string, Effort> = { critical: "medium", high: "low", medium: "low", low: "low" };
const SEV_IMPACT: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2 };

const label = (k: string) => SUB_SCORES.find((s) => s.key === k)?.label ?? VISIBILITY_SUB_SCORES.find((s) => s.key === k)?.label ?? k;

export function Insights({
  auditId,
  findings,
  subScores,
  visibility,
  locked,
}: {
  auditId: string;
  findings: Finding[];
  subScores: { key: SubScoreKey; score: number }[];
  visibility?: VisibilityReport | null;
  locked: boolean;
}) {
  const storeKey = `insights:${auditId}`;
  const [done, setDone] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) setDone(new Set(JSON.parse(raw)));
    } catch {}
  }, [storeKey]);
  function toggle(id: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(storeKey, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  const tasks = useMemo<Task[]>(() => {
    const ux: Task[] = findings.map((f) => ({
      id: f.id,
      href: `#finding-${f.id}`,
      pillar: "ux",
      goal: CATEGORY_GOAL[f.category],
      title: f.title,
      fix: f.recommendedFix,
      severity: f.severity,
      impact: f.impact,
      effort: f.effort,
      gain: Math.round(f.impact * 2.5 + (f.severity === "critical" ? 4 : 0)),
    }));
    const vis: Task[] = (visibility?.checks ?? [])
      .filter((c) => c.status !== "pass")
      .map((c) => ({
        id: `check-${c.id}`,
        href: `#check-${c.id}`,
        pillar: "visibility",
        track: c.track,
        goal: c.group,
        title: `Fix: ${c.label}`,
        fix: c.fix,
        severity: c.severity,
        impact: SEV_IMPACT[c.severity] ?? 3,
        effort: EFFORT_OF[c.severity] ?? "low",
        gain: Math.round((SEV_PENALTY[c.severity] ?? 10) * (c.status === "warn" ? 0.5 : 1)),
      }));
    return [...ux, ...vis];
  }, [findings, visibility]);

  // Score projection: each completed task adds its estimated gain to its criterion.
  const project = (ids: Set<string> | "all") => {
    const add = (k: string) => tasks.filter((t) => t.goal === k && (ids === "all" || ids.has(t.id))).reduce((n, t) => n + t.gain, 0);
    const ux = computeGrowthScore(subScores.map((s) => ({ ...s, rationale: "", score: Math.min(100, s.score + add(s.key)) })));
    const vis = visibility ? visibilityScore(visibility.subScores.map((s) => ({ ...s, score: Math.min(100, s.score + add(s.key)) }))) : null;
    return overallScore(ux, vis);
  };
  const now = project(new Set());
  const withDone = project(done);
  const all = project("all");

  const goals = useMemo(() => {
    const scores: { key: string; score: number; weight: number }[] = [
      ...subScores.map((s) => ({ key: s.key as string, score: s.score, weight: SUB_SCORES.find((d) => d.key === s.key)!.weight * 0.6 })),
      ...(visibility?.subScores ?? []).map((s) => ({ key: s.key as string, score: s.score, weight: VISIBILITY_SUB_SCORES.find((d) => d.key === s.key)!.weight * 0.4 })),
    ];
    return scores
      .map((g) => ({ ...g, tasks: tasks.filter((t) => t.goal === g.key).sort((a, b) => b.gain - a.gain) }))
      .filter((g) => g.tasks.length && g.score < 90)
      .sort((a, b) => (100 - b.score) * b.weight - (100 - a.score) * a.weight);
  }, [subScores, visibility, tasks]);

  const steps = [
    { title: "This week", sub: "High impact, low effort", tone: "bg-good", items: tasks.filter((t) => t.impact >= 4 && t.effort === "low") },
    { title: "This month", sub: "High impact, bigger lift", tone: "bg-accent", items: tasks.filter((t) => t.impact >= 4 && t.effort !== "low") },
    { title: "Next sprint", sub: "Quick wins to batch", tone: "bg-cta", items: tasks.filter((t) => t.impact < 4) },
  ].map((s) => ({ ...s, items: s.items.sort((a, b) => b.gain - a.gain) }));

  return (
    <div className="space-y-10">
      <PanelTitle title="Insights" sub="Your next steps and the jobs to get done to raise the score. Check tasks off as you ship them." />

      {/* Path to 80 */}
      <div className="rounded-3xl bg-gradient-to-br from-accent to-[#ff7a2e] p-6 sm:p-9 text-white shadow-[0_20px_50px_rgb(240_74_15/0.25)]">
        <div className="grid md:grid-cols-[1fr_1.3fr] gap-8 items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/70">Your path to 80+</p>
            <div className="mt-3 flex items-end gap-4">
              <div>
                <p className="text-sm text-white/70">Today</p>
                <p className="text-5xl font-extrabold tabular-nums">{now}</p>
              </div>
              <span className="mb-3 text-2xl text-white/60">→</span>
              <div>
                <p className="text-sm text-white/70">With all tasks done</p>
                <p className="text-5xl font-extrabold tabular-nums">{all}</p>
              </div>
            </div>
            <p className="mt-3 text-white/80">
              {done.size ? `${done.size} of ${tasks.length} tasks done, projected score ${withDone}.` : `${tasks.length} tasks across both pillars. Scores are estimates.`}
            </p>
          </div>
          <div>
            <div className="relative h-4 rounded-full bg-white/20">
              <div className="absolute inset-y-0 left-0 rounded-full bg-white/35 transition-all duration-700" style={{ width: `${all}%` }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-white transition-all duration-700 ease-out" style={{ width: `${Math.max(now, withDone)}%` }} />
              <div className="absolute -top-2 bottom-[-0.5rem] w-0.5 bg-[#ffd166]" style={{ left: "80%" }} />
              <span className="absolute -top-7 -translate-x-1/2 text-xs font-semibold text-[#ffd166]" style={{ left: "80%" }}>Target 80</span>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              {steps.map((s) => (
                <div key={s.title} className="rounded-2xl bg-white/10 p-3">
                  <p className="text-2xl font-extrabold tabular-nums">{s.items.length}</p>
                  <p className="text-xs text-white/75">{s.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Next steps */}
      <section>
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight">Next steps</h3>
        <div className="mt-5 grid md:grid-cols-3 gap-5">
          {steps.map((s, si) => (
            <div key={s.title} className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
              <div className={`${s.tone} px-5 py-4 text-white`}>
                <p className="text-sm font-semibold text-white/80">Step {si + 1}</p>
                <p className="text-lg font-bold">{s.title}</p>
                <p className="text-sm text-white/80">{s.sub} · {s.items.length}</p>
              </div>
              <ol className="divide-y divide-line">
                {s.items.length === 0 && <li className="p-5 text-sm text-subtle">Nothing here.</li>}
                {s.items.slice(0, locked ? 1 : 6).map((t) => (
                  <li key={t.id}>
                    <a href={t.href} className="flex items-start gap-3 p-4 transition-colors hover:bg-surface">
                      <PillarDot pillar={t.pillar} />
                      <span className="min-w-0 flex-1">
                        <span className={`block font-medium leading-snug ${done.has(t.id) ? "text-subtle line-through" : ""}`}>{t.title}</span>
                        <span className="mt-0.5 block text-xs text-subtle">{t.pillar === "ux" ? "UX & UI" : t.track === "geo" ? "GEO · AI answers" : "SEO · search"} · {t.effort} effort</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-good/10 px-2 py-0.5 text-xs font-semibold text-good">+{t.gain}</span>
                    </a>
                  </li>
                ))}
                {locked && s.items.length > 1 && <li className="p-4"><Locked text={`${s.items.length - 1} more steps in Pro`} /></li>}
                {!locked && s.items.length > 6 && <li className="p-4 text-sm text-muted">+{s.items.length - 6} more in the jobs below</li>}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* Jobs to be done */}
      <section>
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight">Jobs to be done</h3>
        <p className="mt-1 text-muted">Grouped by the outcome each one improves, biggest score gap first.</p>
        <div className="mt-5 space-y-5">
          {goals.map((g) => {
            const gain = g.tasks.reduce((n, t) => n + t.gain, 0);
            const finished = g.tasks.filter((t) => done.has(t.id)).length;
            const isUx = SUB_SCORES.some((s) => s.key === g.key);
            return (
              <div key={g.key} className="rounded-3xl border border-line bg-white p-5 sm:p-7 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-subtle">{isUx ? "UX & UI" : "AI & search"} · {label(g.key)}</p>
                    <p className="mt-2 text-lg font-semibold leading-snug">{JOBS[g.key] ?? label(g.key)}</p>
                  </div>
                  <div className="shrink-0 rounded-2xl bg-surface px-4 py-3 text-center">
                    <p className="text-sm tabular-nums">
                      <span className="font-bold">{g.score}</span>
                      <span className="text-subtle"> → </span>
                      <span className="font-bold text-good">~{Math.min(100, g.score + gain)}</span>
                    </p>
                    <p className="text-xs text-muted">{finished}/{g.tasks.length} done</p>
                  </div>
                </div>
                <div className="mt-4 h-1.5 rounded-full bg-surface-2">
                  <div className="h-1.5 rounded-full bg-good transition-all duration-500" style={{ width: `${(finished / g.tasks.length) * 100}%` }} />
                </div>
                <ul className="mt-4 space-y-2">
                  {g.tasks.map((t) => {
                    const on = done.has(t.id);
                    return (
                      <li key={t.id} className={`rounded-2xl border p-4 transition-colors ${on ? "border-good/30 bg-good/5" : "border-line hover:border-line-strong"}`}>
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggle(t.id)}
                            aria-pressed={on}
                            aria-label={on ? `Mark "${t.title}" as not done` : `Mark "${t.title}" as done`}
                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${on ? "border-good bg-good text-white scale-105" : "border-line-strong bg-white hover:border-accent"}`}
                          >
                            {on && <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M5 10.5l3.2 3.2L15 7" /></svg>}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={`font-semibold leading-snug ${on ? "text-muted line-through" : ""}`}>{t.title}</p>
                            {t.fix ? <p className="mt-1 text-sm leading-relaxed text-muted">{t.fix}</p> : <div className="mt-2"><Locked text="The exact change is included in Pro." /></div>}
                            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">Impact {t.impact}/5</span>
                              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">{t.effort} effort</span>
                              <span className="rounded-full bg-good/10 px-2 py-0.5 font-semibold text-good">+{t.gain} pts est.</span>
                              <a href={t.href} className="ml-auto font-semibold text-accent hover:underline underline-offset-4">See issue →</a>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PillarDot({ pillar }: { pillar: "ux" | "visibility" }) {
  return <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${pillar === "ux" ? "bg-accent" : "bg-[#14b8a6]"}`} aria-hidden />;
}
