import { AnnotatedShot } from "../AnnotatedShot";
import { Reveal } from "../Reveal";
import { ScoreRing } from "../ScoreRing";
import { SeverityPill } from "../ui";
import { UpgradeButton } from "../UpgradeButton";
import { AnnotationExplorer } from "./AnnotationExplorer";
import { ExportBar } from "./ExportBar";
import { Findings } from "./Findings";
import { LeadCta } from "./LeadCta";
import { Locked } from "./parts";
import { labelFor, PRIMARY_GOALS, PRODUCT_TYPES } from "@/lib/config";
import { SUB_SCORES, scoreBand, type ActionItem, type Finding } from "@/lib/report";
import type { ViewReport } from "@/lib/gate";

type AuditMeta = {
  id: string;
  productName: string;
  productUrl: string;
  productType: string;
  primaryGoal: string;
  createdAt: Date;
};

const SEV_TILES = [
  { key: "critical", label: "Critical", dot: "bg-critical", text: "text-critical" },
  { key: "high", label: "High", dot: "bg-high", text: "text-high" },
  { key: "medium", label: "Medium", dot: "bg-medium", text: "text-medium" },
  { key: "low", label: "Low", dot: "bg-line-strong", text: "text-muted" },
] as const;

const barColor = (n: number) => (n >= 80 ? "bg-good" : n >= 60 ? "bg-high" : "bg-critical");

export function ReportView({
  audit,
  report,
  mode,
  shareToken,
}: {
  audit: AuditMeta;
  report: ViewReport;
  mode: "owner" | "shared" | "sample";
  shareToken?: string;
}) {
  const band = scoreBand(report.growthScore);
  const byId = new Map(report.findings.map((f) => [f.id, f]));
  const bandCls = band.tone === "good" ? "bg-good/10 text-good" : band.tone === "warn" ? "bg-high/10 text-high" : "bg-critical/10 text-critical";

  return (
    <article className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
      {/* Header */}
      <div className="fade-up flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-accent">{mode === "sample" ? "Sample report" : "Growth Readiness Report"}</p>
          <h1 className="mt-2 text-3xl sm:text-5xl font-extrabold tracking-tight break-words">{audit.productName}</h1>
          <p className="mt-3 text-muted break-words">
            {audit.productUrl && <span>{audit.productUrl} · </span>}
            {labelFor(PRODUCT_TYPES, audit.productType)} ·{" "}
            {new Date(report.generatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <ExportBar auditId={audit.id} shareToken={mode === "owner" ? undefined : shareToken} locked={report.locked} canShare />
      </div>

      {report.locked && mode === "owner" && (
        <div className="fade-up mt-8 rounded-2xl bg-gradient-to-r from-accent to-[#7a3cff] p-5 sm:p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold">You are viewing your free teaser report</p>
            <p className="mt-1 text-white/80">
              Go Pro to unlock every fix, all {report.findings.length} annotated findings and the prioritized action plan, plus unlimited scans.
            </p>
          </div>
          <UpgradeButton className="!bg-white !text-accent hover:!bg-white/90" />
        </div>
      )}

      {/* Overview */}
      <section style={{ ["--delay" as string]: "120ms" }} className="fade-up mt-8 rounded-3xl border border-line bg-white p-5 sm:p-10 shadow-[0_10px_40px_rgb(14_19_37/0.06)]">
        <div className="grid lg:grid-cols-[auto_1fr] gap-8 lg:gap-14 items-center">
          <div className="flex flex-col items-center text-center">
            <ScoreRing score={report.growthScore} size={200} stroke={16} />
            <span className={`mt-4 rounded-full px-3.5 py-1 text-sm font-semibold ${bandCls}`}>{band.label}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wider text-subtle">Executive summary</p>
            <p className="mt-3 text-lg sm:text-xl leading-relaxed text-fg/90">{report.executiveSummary}</p>
            <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SEV_TILES.map((t) => {
                const n = report.findings.filter((f) => f.severity === t.key).length;
                return (
                  <a key={t.key} href="#findings" className="lift rounded-2xl border border-line bg-white p-4">
                    <div className="flex items-center gap-2 text-sm text-muted"><span className={`h-2.5 w-2.5 rounded-full ${t.dot}`} />{t.label}</div>
                    <p className={`mt-1 text-3xl font-extrabold tabular-nums ${n ? t.text : "text-subtle"}`}>{n}</p>
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-line pt-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-subtle">Score breakdown</p>
          <div className="mt-5 grid md:grid-cols-2 gap-x-12 gap-y-6">
            {SUB_SCORES.map((def, i) => {
              const s = report.subScores.find((x) => x.key === def.key);
              if (!s) return null;
              return (
                <div key={def.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{def.label}</span>
                    <span className="shrink-0 tabular-nums">
                      <span className="text-lg font-bold">{s.score}</span>
                      <span className="text-sm text-subtle"> /100</span>
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 rounded-full bg-surface-2 overflow-hidden">
                    <div className={`bar-grow h-2.5 rounded-full ${barColor(s.score)}`} style={{ width: `${s.score}%`, ["--bar-delay" as string]: `${300 + i * 90}ms` }} />
                  </div>
                  <p className="mt-2 text-sm text-muted leading-relaxed">{s.rationale}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Critical issues */}
      <section className="mt-16 sm:mt-20">
        <SectionTitle title="Top 3 critical issues" sub="The changes with the largest expected effect on growth." />
        <div className="mt-8 space-y-6">
          {report.criticalIssues.map((c, i) => {
            const f = byId.get(c.findingId);
            const shot = f?.annotation ? report.screenshots[f.annotation.screenshotIndex] : undefined;
            return (
              <Reveal key={c.findingId} delay={i * 80} className="rounded-3xl border border-line bg-white p-5 sm:p-8 shadow-sm">
                <div className="grid lg:grid-cols-[1fr_minmax(0,480px)] gap-6 lg:gap-10">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-critical text-lg font-bold text-white">{i + 1}</span>
                      <SeverityPill severity={c.impactLevel} />
                      <span className="text-sm text-subtle">{c.impactLevel === "critical" ? "Critical" : "High"} impact</span>
                    </div>
                    <h3 className="mt-5 text-2xl font-bold tracking-tight leading-snug">{c.title}</h3>
                    <p className="mt-5 mb-1.5 text-xs font-bold uppercase tracking-wider text-subtle">Business impact</p>
                    <p className="text-[17px] leading-relaxed text-fg/85">{c.businessImpact}</p>
                    <div className="mt-6 rounded-xl bg-good/8 border border-good/25 p-4 sm:p-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-good">How to fix it</p>
                      {c.fix ? <p className="mt-1.5 leading-relaxed">{c.fix}</p> : <div className="mt-2"><Locked text="The specific fix is included in Pro." /></div>}
                    </div>
                  </div>
                  {shot?.src && f?.annotation ? (
                    <figure className="self-start">
                      <AnnotatedShot src={shot.src} width={shot.width} height={shot.height} alt={shot.label} mode="focus" spotlight markers={[{ box: f.annotation, label: String(i + 1) }]} />
                      <figcaption className="mt-2.5 flex items-start gap-2 text-sm text-muted">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-critical" />
                        <span><span className="font-medium text-fg">{f.annotationNote || "Highlighted area"}</span> · {shot.label}</span>
                      </figcaption>
                    </figure>
                  ) : null}
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Findings */}
      <section id="findings" className="mt-16 sm:mt-20 scroll-mt-20">
        <SectionTitle title="Detailed findings" sub="Filter by area or severity. Each finding shows exactly where it appears." />
        <div className="mt-4">
          <Findings findings={report.findings} screenshots={report.screenshots} />
        </div>
      </section>

      {/* Visual annotations */}
      <section className="mt-16 sm:mt-20">
        <SectionTitle title="Visual annotations" sub="Every captured screen with its findings pinned in place. Hover or tap a comment to locate it." />
        <Reveal className="mt-8">
          <AnnotationExplorer screenshots={report.screenshots} findings={report.findings} />
          {report.locked && report.lockedCounts && report.lockedCounts.screenshots > 0 && (
            <div className="mt-4"><Locked text={`${report.lockedCounts.screenshots} more annotated screens are included in Pro.`} /></div>
          )}
        </Reveal>
      </section>

      {/* Action plan */}
      <section className="mt-16 sm:mt-20">
        <SectionTitle title="Prioritized action plan" sub="What to do first, what to plan, and what to batch into the next sprint." />
        {report.locked ? (
          <div className="mt-8 relative rounded-3xl border border-line overflow-hidden">
            <div className="grid md:grid-cols-3 gap-4 p-4 blur-[3px] opacity-60 select-none" aria-hidden>
              {["High impact / Low effort", "High impact / High effort", "Quick wins"].map((t) => (
                <div key={t} className="rounded-2xl bg-surface p-6 h-56">
                  <p className="font-semibold">{t}</p>
                  {[1, 2, 3].map((n) => <div key={n} className="mt-4 h-3 rounded bg-line-strong w-4/5" />)}
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-white/70">
              <p className="text-2xl sm:text-3xl font-bold tracking-tight">The action plan is part of Pro</p>
              <p className="mt-2 max-w-md text-muted">Specific, detailed changes for every finding, sequenced by impact and effort.</p>
              {mode === "owner" ? <div className="mt-5"><UpgradeButton /></div> : <a href="/upgrade" className="mt-5 font-semibold text-accent hover:underline underline-offset-4">See Pro</a>}
            </div>
          </div>
        ) : (
          <div className="mt-8 grid md:grid-cols-3 gap-5">
            <Quadrant title="High impact / Low effort" sub="Do first" tone="good" items={report.actionPlan.highImpactLowEffort} byId={byId} />
            <Quadrant title="High impact / High effort" sub="Plan into the roadmap" tone="accent" items={report.actionPlan.highImpactHighEffort} byId={byId} delay={90} />
            <Quadrant title="Quick wins" sub="Batch into the next sprint" tone="cta" items={report.actionPlan.quickWins} byId={byId} delay={180} />
          </div>
        )}
      </section>

      {/* Bottom CTA */}
      <Reveal className="mt-16 sm:mt-20 rounded-3xl bg-fg p-6 sm:p-12 text-white no-print">
        <div className="grid md:grid-cols-[1.4fr_1fr] gap-8 md:gap-10 items-center">
          <div>
            <p className="text-sm font-semibold text-[#b9adff]">Go further</p>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold tracking-tight">Turn this report into a growth roadmap.</h2>
            <p className="mt-3 text-white/70 leading-relaxed">A senior product strategist from Matan.Design reviews your product end to end, validates these findings against your data, and leads the first changes with your team.</p>
          </div>
          <div className="flex flex-col gap-3">
            <LeadCta kind="human_audit" label="Upgrade to Human Executive Audit" href={process.env.HUMAN_AUDIT_URL || undefined} auditId={mode === "sample" ? undefined : audit.id} variant="cta" />
            <LeadCta kind="strategy_call" label="Book Strategy Call" href={process.env.STRATEGY_CALL_URL || undefined} auditId={mode === "sample" ? undefined : audit.id} variant="light" />
          </div>
        </div>
      </Reveal>
      {mode !== "sample" && (
        <p className="mt-6 text-xs text-subtle">
          Generated by the {report.engine === "claude" ? "AI analysis engine" : "heuristic analysis engine"} from {report.screenshots.length} captured screens.
        </p>
      )}
    </article>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <Reveal>
      <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">{title}</h2>
      {sub && <p className="mt-2 text-muted sm:text-lg">{sub}</p>}
    </Reveal>
  );
}

const TONES = {
  good: { head: "bg-good", ring: "border-good/30" },
  accent: { head: "bg-accent", ring: "border-accent/30" },
  cta: { head: "bg-cta", ring: "border-cta/30" },
} as const;

function Quadrant({ title, sub, items, byId, tone, delay = 0 }: { title: string; sub: string; items: ActionItem[]; byId: Map<string, Finding>; tone: keyof typeof TONES; delay?: number }) {
  const t = TONES[tone];
  return (
    <Reveal delay={delay} className={`rounded-3xl border ${t.ring} bg-white overflow-hidden shadow-sm`}>
      <div className={`${t.head} px-6 py-4 text-white`}>
        <p className="font-bold">{title}</p>
        <p className="text-sm text-white/80">{sub} · {items.length}</p>
      </div>
      <ol className="divide-y divide-line">
        {items.length === 0 && <li className="p-6 text-sm text-subtle">None identified.</li>}
        {items.map((a) => (
          <li key={a.findingId}>
            <a href={`#finding-${a.findingId}`} className="block p-5 transition-colors hover:bg-surface">
              <p className="font-semibold leading-snug">{a.title}</p>
              <p className="mt-1.5 text-sm text-muted leading-relaxed line-clamp-3">{byId.get(a.findingId)?.recommendedFix}</p>
              <p className="mt-2 text-xs text-subtle">{a.findingId} · Impact {a.impact}/5 · {a.effort} effort</p>
            </a>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}
