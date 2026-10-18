import { AnnotatedShot } from "../AnnotatedShot";
import { Reveal } from "../Reveal";
import { ScoreRing } from "../ScoreRing";
import { SeverityPill } from "../ui";
import { UpgradeButton } from "../UpgradeButton";
import { ExportBar } from "./ExportBar";
import { CrawledPages } from "./CrawledPages";
import { Insights } from "./Insights";
import { IssuesPanel } from "./IssuesPanel";
import { ReportTabs } from "./ReportTabs";
import { Redesign } from "./Redesign";
import { Statistics } from "./Statistics";
import { AiHealthCard, BotAccessCard } from "./VisibilityParts";
import { LeadCta } from "./LeadCta";
import { Locked } from "./parts";
import { CountUp } from "../CountUp";
import { labelFor, PRIMARY_GOALS, PRODUCT_TYPES } from "@/lib/config";
import { SUB_SCORES, scoreBand } from "@/lib/report";
import { overallScore } from "@/lib/visibility";
import type { ViewReport } from "@/lib/gate";
import type { RedesignView } from "@/lib/redesign";

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
  redesign = null,
  mode,
  shareToken,
}: {
  audit: AuditMeta;
  report: ViewReport;
  redesign?: RedesignView | null;
  mode: "owner" | "shared" | "sample";
  shareToken?: string;
}) {
  const band = scoreBand(report.growthScore);
  const byId = new Map(report.findings.map((f) => [f.id, f]));
  const v = report.visibility ?? null;
  const overall = overallScore(report.growthScore, v?.score);
  const issueCount = report.findings.length + (v ? v.checks.filter((c) => c.status !== "pass").length : 0);
  // Owners always see the Redesign tab (start it, or the Pro teaser); shared links only when one exists.
  const showRedesign = mode === "owner" || redesign?.status === "complete";
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

      <div style={{ ["--delay" as string]: "120ms" }} className="fade-up mt-8">
        <ReportTabs
          tabs={[
            { id: "overview", label: "Overview" },
            ...(showRedesign ? [{ id: "redesign", label: "Redesign", badge: "New" }] : []),
            { id: "issues", label: "Issues", count: issueCount },
            { id: "pages", label: "Crawled Pages", count: v ? v.pages.length : report.screenshots.length },
            { id: "statistics", label: "Statistics" },
            { id: "insights", label: "Insights" },
          ]}
          panels={{
            overview: (
              <>
                <PillarSummary overall={overall} ux={report.growthScore} visibility={v?.score ?? null} />
                {showRedesign && <RedesignBanner productName={audit.productName} ready={redesign?.status === "complete"} projected={redesign?.plan?.projectedScore} />}
      {/* Overview */}
      <section className="rounded-3xl border border-line bg-white p-5 sm:p-10 shadow-[0_10px_40px_rgb(14_19_37/0.06)]">
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
                  <a key={t.key} href="#issues" className="lift rounded-2xl border border-line bg-white p-4">
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
      <section className="mt-14">
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


                {v && (
                  <section className="mt-14">
                    <SectionTitle title="AI & search visibility" sub="SEO and GEO: how well search engines and AI answer engines can find, read and cite you." />
                    <div className="mt-8 grid lg:grid-cols-2 gap-6">
                      <Reveal><AiHealthCard v={v} /></Reveal>
                      <Reveal delay={90}><BotAccessCard v={v} /></Reveal>
                    </div>
                    <p className="mt-5 text-center"><a href="#issues" className="font-semibold text-accent hover:underline underline-offset-4">See every AI & search issue and how to fix it →</a></p>
                  </section>
                )}
              </>
            ),
            redesign: (
              <Redesign
                auditId={audit.id}
                productName={audit.productName}
                initial={redesign}
                mode={mode}
                locked={report.locked}
                currentScore={report.growthScore}
                findingTitles={Object.fromEntries(report.findings.map((f) => [f.id, f.title]))}
              />
            ),
            issues: <IssuesPanel findings={report.findings} screenshots={report.screenshots} visibility={v} />,
            pages: <CrawledPages report={report} />,
            statistics: <Statistics report={report} />,
            insights: <Insights auditId={audit.id} findings={report.findings} subScores={report.subScores} visibility={v} locked={report.locked} />,
          }}
        />
      </div>

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

function RedesignBanner({ productName, ready, projected }: { productName: string; ready: boolean; projected?: number }) {
  return (
    <a href="#redesign" className="group mb-6 flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl bg-gradient-to-r from-accent to-[#7a3cff] p-5 sm:p-6 text-white shadow-[0_14px_34px_-14px_rgb(91_69_255/0.8)] transition-transform hover:-translate-y-0.5 no-print">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden><path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zm7 11l.9 2.6 2.6.9-2.6.9L19 20l-.9-2.6-2.6-.9 2.6-.9L19 13z" /></svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold">{ready ? `${productName}, redesigned with every fix applied` : `See ${productName} redesigned in one click`}</span>
        <span className="block text-white/80">{ready ? `Before and after, rewritten copy and a new styleguide${projected ? `. Projected UX score ${projected}` : ""}.` : "Rewritten headline and CTAs, a new styleguide and a before and after of your page."}</span>
      </span>
      <span className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-accent transition-transform group-hover:translate-x-0.5">{ready ? "View redesign →" : "Open Redesign →"}</span>
    </a>
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

function PillarSummary({ overall, ux, visibility }: { overall: number; ux: number; visibility: number | null }) {
  const tone = (n: number) => (n >= 80 ? "text-good" : n >= 60 ? "text-high" : "text-critical");
  const items = [
    { label: "Overall audit score", sub: visibility == null ? "UX & UI only" : "60% UX & UI · 40% AI & search", value: overall },
    { label: "Executive UX & UI", sub: "Growth readiness of the experience", value: ux },
    { label: "AI & search visibility", sub: "SEO and GEO readiness", value: visibility },
  ];
  return (
    <div className="mb-6 grid sm:grid-cols-3 gap-4">
      {items.map((k, i) => (
        <Reveal key={k.label} delay={i * 70} className={`lift rounded-2xl border bg-white p-5 shadow-sm ${i === 0 ? "border-accent/40 ring-1 ring-accent/20" : "border-line"}`}>
          <p className="text-sm font-semibold">{k.label}</p>
          <p className="text-xs text-subtle">{k.sub}</p>
          {k.value == null ? (
            <p className="mt-3 text-sm text-muted">Needs a public URL. <a href="#issues" className="text-accent font-medium">Why?</a></p>
          ) : (
            <>
              <p className={`mt-2 text-4xl font-extrabold tracking-tight ${tone(k.value)}`}><CountUp value={k.value} /><span className="text-lg font-semibold text-subtle">/100</span></p>
              <div className="mt-3 h-2 rounded-full bg-surface-2"><div className={`bar-grow h-2 rounded-full ${k.value >= 80 ? "bg-good" : k.value >= 60 ? "bg-high" : "bg-critical"}`} style={{ width: `${k.value}%`, ["--bar-delay" as string]: `${250 + i * 90}ms` }} /></div>
            </>
          )}
        </Reveal>
      ))}
    </div>
  );
}
