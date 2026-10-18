import { Reveal } from "../Reveal";
import { CountUp } from "../CountUp";
import { PanelTitle } from "./PanelTitle";
import { FINDING_CATEGORIES } from "@/lib/config";
import { SUB_SCORES } from "@/lib/report";
import type { ViewReport } from "@/lib/gate";
import { overallScore } from "@/lib/visibility";

const SEV = [
  { key: "critical", label: "Critical", cls: "bg-critical" },
  { key: "high", label: "High", cls: "bg-high" },
  { key: "medium", label: "Medium", cls: "bg-medium" },
  { key: "low", label: "Low", cls: "bg-line-strong" },
] as const;

const scoreText = (n: number) => (n >= 80 ? "text-good" : n >= 60 ? "text-high" : "text-critical");

function Card({ title, sub, children, delay = 0, className = "" }: { title: string; sub?: string; children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <Reveal delay={delay} className={`rounded-3xl border border-line bg-white p-6 sm:p-7 shadow-sm ${className}`}>
      <h3 className="text-lg font-semibold">{title}</h3>
      {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      <div className="mt-5">{children}</div>
    </Reveal>
  );
}

function Bars({ rows, max, unit = "" }: { rows: { label: string; value: number; cls?: string; note?: string }[]; max: number; unit?: string }) {
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.label} className="group" title={`${r.label}: ${r.value}${unit}${r.note ? ` · ${r.note}` : ""}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-muted group-hover:text-fg transition-colors">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{r.value}{unit}</span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-surface-2">
            <div className={`bar-grow h-2.5 rounded-full ${r.cls ?? "bg-accent"} transition-[filter] group-hover:brightness-110`} style={{ width: `${max ? Math.max(2, (r.value / max) * 100) : 0}%`, ["--bar-delay" as string]: `${150 + i * 60}ms` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Statistics({ report }: { report: ViewReport }) {
  const v = report.visibility;
  const f = report.findings;
  const total = overallScore(report.growthScore, v?.score);

  const sevCounts = SEV.map((s) => ({
    ...s,
    ux: f.filter((x) => x.severity === s.key).length,
    vis: v ? v.checks.filter((c) => c.status !== "pass" && c.severity === s.key).length : 0,
  }));
  const maxSev = Math.max(1, ...sevCounts.map((s) => s.ux + s.vis));

  const cats = FINDING_CATEGORIES.map((c) => ({ label: c.label, value: f.filter((x) => x.category === c.value).length })).filter((c) => c.value);

  const lost = SUB_SCORES.map((d) => {
    const s = report.subScores.find((x) => x.key === d.key)?.score ?? 0;
    return { label: d.label, value: Math.round((100 - s) * d.weight * 10) / 10, note: `score ${s}, weight ${Math.round(d.weight * 100)}%` };
  }).sort((a, b) => b.value - a.value);

  const efforts = ["low", "medium", "high"] as const;
  const matrix = [5, 4, 3, 2, 1].map((impact) => efforts.map((e) => f.filter((x) => x.impact === impact && x.effort === e).length));
  const maxCell = Math.max(1, ...matrix.flat());

  const perScreen = report.screenshots
    .map((s, i) => ({ label: s.label, value: f.filter((x) => x.annotation?.screenshotIndex === i).length }))
    .filter((r) => r.value);

  const checks = v ? { pass: v.checks.filter((c) => c.status === "pass").length, warn: v.checks.filter((c) => c.status === "warn").length, fail: v.checks.filter((c) => c.status === "fail").length } : null;
  const checksTotal = checks ? checks.pass + checks.warn + checks.fail : 0;

  return (
    <div className="space-y-6">
      <PanelTitle title="Statistics" sub="The numbers behind the scores, across both audit pillars." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Overall audit score", value: total, suffix: "/100", cls: scoreText(total) },
          { label: "UX & UI score", value: report.growthScore, suffix: "/100", cls: scoreText(report.growthScore) },
          { label: "AI & search visibility", value: v?.score ?? null, suffix: "/100", cls: v ? scoreText(v.score) : "" },
          { label: "Total issues", value: f.length + (checks ? checks.warn + checks.fail : 0), suffix: "", cls: "text-fg" },
        ].map((k, i) => (
          <Reveal key={k.label} delay={i * 70} className="lift rounded-2xl border border-line bg-white p-5 shadow-sm">
            <p className="text-sm text-muted">{k.label}</p>
            <p className={`mt-1 text-4xl font-extrabold tracking-tight ${k.cls}`}>
              {k.value == null ? <span className="text-2xl text-subtle">n/a</span> : <><CountUp value={k.value} /><span className="text-lg font-semibold text-subtle">{k.suffix}</span></>}
            </p>
          </Reveal>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Issues by severity" sub={v ? "UX & UI findings plus AI & search issues" : "UX & UI findings"}>
          <div className="space-y-3.5">
            {sevCounts.map((s, i) => (
              <div key={s.key} title={`${s.label}: ${s.ux} UX & UI, ${s.vis} AI & search`}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted"><span className={`h-2.5 w-2.5 rounded-full ${s.cls}`} />{s.label}</span>
                  <span className="font-semibold tabular-nums">{s.ux + s.vis}</span>
                </div>
                <div className="mt-1 flex h-2.5 gap-0.5 rounded-full bg-surface-2">
                  {s.ux > 0 && <div className={`bar-grow h-2.5 rounded-l-full ${s.vis ? "" : "rounded-r-full"} ${s.cls}`} style={{ width: `${(s.ux / maxSev) * 100}%`, ["--bar-delay" as string]: `${150 + i * 60}ms` }} />}
                  {s.vis > 0 && <div className={`bar-grow h-2.5 rounded-r-full ${s.ux ? "" : "rounded-l-full"} ${s.cls} opacity-45`} style={{ width: `${(s.vis / maxSev) * 100}%`, ["--bar-delay" as string]: `${220 + i * 60}ms` }} />}
                </div>
              </div>
            ))}
          </div>
          {v && (
            <p className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-fg/80" />UX & UI</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-fg/35" />AI & search</span>
            </p>
          )}
        </Card>

        <Card title="Where the UX score loses points" sub="Points lost per criterion after weighting. Fix the top rows first." delay={80}>
          <Bars rows={lost} max={Math.max(...lost.map((l) => l.value), 1)} unit=" pts" />
        </Card>

        <Card title="Impact vs effort" sub="How many findings sit in each cell. Top-left is the best return.">
          <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-1.5 text-center text-sm">
            <span />
            {efforts.map((e) => <span key={e} className="pb-1 text-xs font-semibold uppercase tracking-wider text-subtle">{e} effort</span>)}
            {matrix.map((row, r) => (
              <div key={r} className="contents">
                <span className="flex items-center pr-2 text-xs font-semibold text-subtle">Impact {5 - r}</span>
                {row.map((n, c) => (
                  <div
                    key={c}
                    title={`${n} findings · impact ${5 - r}, ${efforts[c]} effort`}
                    className="flex h-12 items-center justify-center rounded-lg font-bold tabular-nums transition-transform hover:scale-[1.04]"
                    style={{ background: n ? `rgb(91 69 255 / ${0.12 + (n / maxCell) * 0.7})` : "var(--color-surface)", color: n / maxCell > 0.55 ? "white" : "var(--color-fg)" }}
                  >
                    {n || ""}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Findings by area" delay={80}>
          <Bars rows={cats} max={Math.max(...cats.map((c) => c.value), 1)} />
          {perScreen.length > 0 && (
            <>
              <h4 className="mt-7 text-sm font-semibold">Findings per screen</h4>
              <div className="mt-3"><Bars rows={perScreen} max={Math.max(...perScreen.map((c) => c.value), 1)} /></div>
            </>
          )}
        </Card>

        {v && checks && (
          <>
            <Card title="AI & search checks" sub={`${checksTotal} checks across ${v.pages.length} crawled pages`}>
              <div className="flex h-4 gap-0.5 overflow-hidden rounded-full">
                <span className="bar-grow bg-good" style={{ width: `${(checks.pass / checksTotal) * 100}%` }} title={`${checks.pass} passed`} />
                <span className="bar-grow bg-high" style={{ width: `${(checks.warn / checksTotal) * 100}%`, ["--bar-delay" as string]: "300ms" }} title={`${checks.warn} warnings`} />
                <span className="bar-grow bg-critical" style={{ width: `${(checks.fail / checksTotal) * 100}%`, ["--bar-delay" as string]: "450ms" }} title={`${checks.fail} errors`} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                {([["Passed", checks.pass, "text-good"], ["Warnings", checks.warn, "text-high"], ["Errors", checks.fail, "text-critical"]] as const).map(([l, n, c]) => (
                  <div key={l} className="rounded-xl bg-surface p-3">
                    <p className={`text-2xl font-extrabold tabular-nums ${c}`}><CountUp value={n} /></p>
                    <p className="text-xs text-muted">{l}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm">
                <Stat label="Indexable pages" value={`${v.pages.filter((p) => p.indexable).length}/${v.pages.length}`} />
                <Stat label="With structured data" value={`${v.pages.filter((p) => p.hasStructuredData).length}/${v.pages.length}`} />
                <Stat label="AI crawlers allowed" value={`${v.bots.filter((b) => b.allowed).length}/${v.bots.length}`} />
              </div>
            </Card>

            <Card title="Load time per page" sub="Seconds to load the HTML. Over 2.5s is marked." delay={80}>
              <Bars
                rows={v.pages.map((p) => ({ label: safePath(p.url), value: Math.round(p.loadMs / 100) / 10, cls: p.loadMs > 2500 ? "bg-critical" : "bg-accent" }))}
                max={Math.max(3, ...v.pages.map((p) => p.loadMs / 1000))}
                unit="s"
              />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted leading-tight">{label}</p>
    </div>
  );
}

function safePath(url: string) {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}
