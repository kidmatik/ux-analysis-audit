import Link from "next/link";
import { AnnotatedShot } from "@/components/AnnotatedShot";
import { CountUp } from "@/components/CountUp";
import { Reveal } from "@/components/Reveal";
import { ScoreRing } from "@/components/ScoreRing";
import { SeverityPill } from "@/components/ui";
import { BENCHMARK_LABEL, BENCHMARKS, EVIDENCE, SAMPLE_KPIS, SCORE_MARKERS, SUB_SCORE_SPARK, SURFACES } from "@/lib/landing";

const SPARK_COLORS = ["bg-critical", "bg-critical", "bg-high", "bg-high", "bg-high", "bg-critical"];

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
      <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">{body}</p>
    </div>
  );
}

/** Four animated KPI cards summarising the sample audit. */
export function KpiStrip() {
  const f = SAMPLE_KPIS.findings;
  const total = f.critical + f.high + f.medium;
  return (
    <section className="mx-auto max-w-6xl px-5 sm:px-6 py-16 sm:py-24">
      <SectionHead eyebrow="One audit, measured" title="Numbers your team can act on" body="Every audit ends in a score, a count of what is broken and how quickly you can fix it. These are the results of the Acme Insights sample audit." />
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Reveal className="lift rounded-2xl border border-line bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-muted">Growth Readiness</p>
          <p className="mt-2 text-5xl font-extrabold tracking-tight"><CountUp value={SAMPLE_KPIS.score} /><span className="text-xl font-semibold text-subtle">/100</span></p>
          <div className="mt-5 flex h-12 items-end gap-1.5" aria-label="Six sub-scores">
            {SUB_SCORE_SPARK.map((v, i) => (
              <span key={i} className={`grow-y flex-1 rounded-t-[4px] ${SPARK_COLORS[i]}`} style={{ height: `${v}%`, ["--bar-delay" as string]: `${200 + i * 70}ms` }} title={`${v}/100`} />
            ))}
          </div>
          <p className="mt-3 text-xs text-subtle">Six weighted sub-scores</p>
        </Reveal>

        <Reveal delay={80} className="lift rounded-2xl border border-line bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-muted">Issues found</p>
          <p className="mt-2 text-5xl font-extrabold tracking-tight"><CountUp value={total} /></p>
          <div className="mt-5 flex h-3 gap-0.5 overflow-hidden rounded-full">
            <span className="bar-grow bg-critical" style={{ width: `${(f.critical / total) * 100}%`, ["--bar-delay" as string]: "250ms" }} />
            <span className="bar-grow bg-high" style={{ width: `${(f.high / total) * 100}%`, ["--bar-delay" as string]: "400ms" }} />
            <span className="bar-grow bg-medium" style={{ width: `${(f.medium / total) * 100}%`, ["--bar-delay" as string]: "550ms" }} />
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-critical" />{f.critical} critical</li>
            <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-high" />{f.high} high</li>
            <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-medium" />{f.medium} medium</li>
          </ul>
        </Reveal>

        <Reveal delay={160} className="lift rounded-2xl border border-line bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-muted">Screens annotated</p>
          <p className="mt-2 text-5xl font-extrabold tracking-tight"><CountUp value={SAMPLE_KPIS.screens} /></p>
          <div className="mt-5 grid grid-cols-5 gap-1.5">
            {["home", "home-2", "signup", "app", "mobile"].map((s, i) => (
              <div key={s} className="relative aspect-[4/5] overflow-hidden rounded-md border border-line bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/sample/${s}.png`} alt="" className="h-full w-full object-cover object-top" loading="lazy" />
                <span className="marker-pop absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-critical" style={{ animationDelay: `${400 + i * 120}ms` }} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-subtle">Website, sign-up, dashboard and mobile</p>
        </Reveal>

        <Reveal delay={240} className="lift rounded-2xl border border-line bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-muted">Quick wins</p>
          <p className="mt-2 text-5xl font-extrabold tracking-tight"><CountUp value={SAMPLE_KPIS.quickWins} /><span className="text-xl font-semibold text-subtle">/{total}</span></p>
          <div className="mt-5 h-3 rounded-full bg-surface-2">
            <div className="bar-grow h-3 rounded-full bg-good" style={{ width: `${(SAMPLE_KPIS.quickWins / total) * 100}%`, ["--bar-delay" as string]: "300ms" }} />
          </div>
          <p className="mt-3 text-xs text-subtle">Findings that are low effort to fix</p>
        </Reveal>
      </div>
    </section>
  );
}

/** Sub-scores against a benchmark, plus where the total score sits on the scale. */
export function Benchmarks() {
  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 py-16 sm:py-24">
        <SectionHead eyebrow="Scores and benchmarks" title="See exactly where you fall behind" body="Each criterion is scored from 0 to 100 and compared with strong SaaS products, so the biggest gaps are obvious at a glance." />
        <div className="mt-12 grid lg:grid-cols-[1.5fr_1fr] gap-6">
          <Reveal className="rounded-2xl border border-line bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Sub-scores vs benchmark</h3>
              <ul className="flex flex-wrap gap-4 text-sm text-muted">
                <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-accent" />Acme Insights</li>
                <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[#b9bfd0]" />{BENCHMARK_LABEL}</li>
              </ul>
            </div>
            <div className="mt-7 space-y-5">
              {BENCHMARKS.map((b, i) => (
                <div key={b.label} tabIndex={0} className="group relative grid grid-cols-[minmax(0,7.5rem)_1fr_auto] sm:grid-cols-[10rem_1fr_auto] items-center gap-x-3 sm:gap-x-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                  <span className="text-sm text-muted leading-tight">{b.label}</span>
                  <div className="space-y-1">
                    <div className="h-2.5 rounded-full bg-surface-2">
                      <div className="bar-grow h-2.5 rounded-full bg-accent" style={{ width: `${b.product}%`, ["--bar-delay" as string]: `${150 + i * 80}ms` }} />
                    </div>
                    <div className="h-2.5 rounded-full bg-surface-2">
                      <div className="bar-grow h-2.5 rounded-full bg-[#b9bfd0]" style={{ width: `${b.benchmark}%`, ["--bar-delay" as string]: `${230 + i * 80}ms` }} />
                    </div>
                  </div>
                  <span className="w-14 text-right text-sm tabular-nums">
                    <span className="font-semibold text-fg">{b.product}</span>
                    <span className="text-subtle"> / {b.benchmark}</span>
                  </span>
                  <span className="pointer-events-none absolute left-1/2 -top-9 z-10 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md bg-fg px-2.5 py-1 text-xs text-white opacity-0 shadow-lg transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                    {b.label}: {b.product} vs {b.benchmark} · gap {b.benchmark - b.product} points
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-subtle">Benchmark values are illustrative. Hover or focus a row for the gap.</p>
          </Reveal>

          <div className="grid gap-6">
            <Reveal delay={100} className="rounded-2xl border border-line bg-white p-6 sm:p-8 shadow-sm">
              <h3 className="text-lg font-semibold">Growth Readiness scale</h3>
              <div className="relative mx-6 sm:mx-8 mt-12 mb-10">
                <div className="flex h-3 overflow-hidden rounded-full">
                  <span className="bg-critical" style={{ width: "60%" }} />
                  <span className="bg-high" style={{ width: "20%" }} />
                  <span className="bg-good" style={{ width: "20%" }} />
                </div>
                {SCORE_MARKERS.map((m, i) => (
                  <div key={m.label} className="marker-pop absolute top-1/2" style={{ left: `${m.value}%`, animationDelay: `${300 + i * 150}ms` }}>
                    <span className={`block -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow ${m.tone === "product" ? "ping-soft h-5 w-5 bg-fg" : "h-4 w-4 bg-white ring-2 ring-fg/40"}`} />
                    <span className={`absolute -translate-x-1/2 whitespace-nowrap text-xs ${i % 2 === 0 ? "-top-9" : "top-4"} ${m.tone === "product" ? "font-semibold text-fg" : "text-muted"}`}>
                      {m.label} <span className="tabular-nums">{m.value}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 text-xs text-muted">
                <span>0–59 Critical blockers</span>
                <span className="text-center">60–79 Gaps</span>
                <span className="text-right">80+ Growth ready</span>
              </div>
            </Reveal>

            <Reveal delay={180} className="rounded-2xl border border-line bg-white p-6 sm:p-8 shadow-sm flex items-center gap-6">
              <ScoreRing score={SAMPLE_KPIS.score} size={112} stroke={10} label="Score" />
              <div>
                <p className="text-3xl font-extrabold tracking-tight text-critical"><CountUp value={81 - SAMPLE_KPIS.score} prefix="−" /> pts</p>
                <p className="mt-1 text-sm text-muted leading-relaxed">behind the top quartile. Fixing the three critical issues closes most of the gap.</p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Each stat paired with the screenshot region it was measured on. */
export function Evidence() {
  return (
    <section className="mx-auto max-w-6xl px-5 sm:px-6 py-16 sm:py-24">
      <SectionHead eyebrow="Proof, not opinions" title="Every number points to the exact spot" body="Stats from the sample audit, each shown on the screen it was measured on. Your report pins every finding the same way." />
      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {EVIDENCE.map((e, i) => (
          <Reveal key={i} delay={(i % 3) * 90} className="lift group flex flex-col rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="transition-transform duration-500 group-hover:scale-[1.015]">
              <AnnotatedShot src={e.shot} width={e.w} height={e.h} markers={[{ box: e.box, label: String(i + 1) }]} mode="focus" alt={`${e.where}: ${e.title}`} />
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <SeverityPill severity={e.severity} />
              <span className="text-xs text-subtle">{e.where}</span>
            </div>
            <p className="mt-3 text-4xl font-extrabold tracking-tight"><CountUp value={e.value} suffix={e.suffix} /></p>
            <p className="mt-1 text-muted">{e.title}</p>
          </Reveal>
        ))}
      </div>
      <p className="mt-10 text-center">
        <Link href="/sample" className="font-semibold text-accent hover:underline underline-offset-4">Open the full sample report →</Link>
      </p>
    </section>
  );
}

/** What can be audited: websites, signed-in apps and dashboards, and designs. */
export function Surfaces({ signedIn }: { signedIn: boolean }) {
  return (
    <section id="what" className="border-y border-line bg-surface scroll-mt-16">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 py-16 sm:py-24">
        <SectionHead eyebrow="Beyond landing pages" title="Audit your website, your app and your dashboards" body="The same scoring and annotated findings work on public pages, signed-in product screens, complex dashboards and designs that have not shipped yet." />
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {SURFACES.map((s, i) => {
            const next = `/audits/new?method=${s.method}`;
            const href = signedIn ? next : `/signup?callbackUrl=${encodeURIComponent(next)}`;
            return (
              <Reveal key={s.title} delay={i * 100} className="lift flex flex-col rounded-2xl border border-line bg-white p-6 shadow-sm">
                <AnnotatedShot src={s.shot} width={s.w} height={s.h} markers={[{ box: s.box, label: String(i + 1) }]} alt={s.title} />
                <h3 className="mt-6 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 flex-1 text-muted leading-relaxed">{s.body}</p>
                <Link href={href} className="mt-5 inline-flex items-center gap-1 font-semibold text-accent hover:gap-2 transition-all">
                  {s.cta} <span aria-hidden>→</span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
