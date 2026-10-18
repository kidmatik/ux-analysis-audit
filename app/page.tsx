import { SiteHeader } from "@/components/SiteHeader";
import { HeroAuditForm } from "@/components/HeroAuditForm";
import { ScoreRing } from "@/components/ScoreRing";
import { ButtonLink } from "@/components/ui";
import { Reveal } from "@/components/Reveal";
import { currentUser } from "@/lib/auth";
import { PRICING } from "@/lib/config";
import { SUB_SCORES } from "@/lib/report";
import { Benchmarks, Evidence, KpiStrip, Pillars, Surfaces } from "@/components/landing/Sections";
import { VISIBILITY_SUB_SCORES } from "@/lib/visibility";

const STEPS = [
  {
    n: "1",
    color: "bg-accent",
    title: "Enter your URL",
    body: "Paste a live URL, or share demo access, a Figma file, screenshots or a screen recording. Credentials are encrypted and deleted after analysis.",
  },
  {
    n: "2",
    color: "bg-cta",
    title: "We scan every screen",
    body: "Every screen is reviewed like a senior UX lead would, and your pages are crawled for SEO and GEO: indexing, AI crawler access, metadata and structured data.",
  },
  {
    n: "3",
    color: "bg-good",
    title: "Fix what matters first",
    body: "Get a Growth Readiness Score, issues pinned to the exact place on screen, and an action plan ranked by impact and effort.",
  },
];


export default async function Landing() {
  const user = await currentUser();
  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="hero-glow absolute inset-0" />
          <div className="relative mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
            <p className="fade-up inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-muted shadow-sm">
              <span className="h-2 w-2 rounded-full bg-good" />
              <span className="sm:hidden">Executive UX + AI & search visibility</span>
              <span className="hidden sm:inline">Executive UX audit + AI & search visibility (SEO & GEO)</span>
            </p>
            <h1 style={{ ["--delay" as string]: "80ms" }} className="fade-up mt-7 text-[40px] sm:text-6xl lg:text-7xl font-extrabold tracking-[-0.035em] leading-[1.02]">
              Find what’s blocking growth <span className="text-accent">inside your product.</span>
            </h1>
            <p style={{ ["--delay" as string]: "160ms" }} className="fade-up mx-auto mt-6 max-w-2xl text-lg md:text-xl text-muted leading-relaxed">
              A senior-level UX and UI audit of your website, app or dashboard, plus an AI and search visibility check for Google, ChatGPT, Claude and Perplexity. Every issue is pinned on screen, with a clear plan of what to fix first.
            </p>
            <div style={{ ["--delay" as string]: "240ms" }} className="fade-up mx-auto mt-10 max-w-2xl">
              <HeroAuditForm signedIn={Boolean(user)} />
            </div>
            <p style={{ ["--delay" as string]: "320ms" }} className="fade-up mt-4 text-sm text-subtle">
              First scan free · No credit card ·{" "}
              <a href="/sample" className="text-accent font-medium hover:underline underline-offset-4">See a sample report</a>
            </p>
            <p style={{ ["--delay" as string]: "380ms" }} className="fade-up mt-2 text-sm text-subtle">
              Auditing a signed-in app or dashboard?{" "}
              <a href={user ? "/audits/new?method=demo" : `/signup?callbackUrl=${encodeURIComponent("/audits/new?method=demo")}`} className="text-accent font-medium hover:underline underline-offset-4">Use a demo login</a>
              {" "}or{" "}
              <a href={user ? "/audits/new?method=figma" : `/signup?callbackUrl=${encodeURIComponent("/audits/new?method=figma")}`} className="text-accent font-medium hover:underline underline-offset-4">a Figma file</a>
            </p>
          </div>
          <div style={{ ["--delay" as string]: "420ms" }} className="fade-up relative mx-auto max-w-5xl px-4 sm:px-6 pb-20 sm:pb-24">
            <HeroPreview />
          </div>
        </section>

        <Pillars />
        <KpiStrip />
        <Surfaces signedIn={Boolean(user)} />
        <Evidence />
        <Benchmarks />

        {/* Process */}
        <section id="how" className="mx-auto max-w-6xl px-5 sm:px-6 py-16 sm:py-24 scroll-mt-16">
          <h2 className="text-center text-3xl md:text-4xl font-bold tracking-tight">How it works</h2>
          <div className="mt-14 grid md:grid-cols-3 gap-10">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 110} className="text-center md:text-left">
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${s.color} text-lg font-bold text-white`}>{s.n}</span>
                <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
                <p className="mt-3 text-muted leading-relaxed">{s.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Criteria */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 py-16 sm:py-24">
            <h2 className="text-center text-3xl md:text-4xl font-bold tracking-tight">Two scores your whole team understands</h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-muted">Each pillar weighs six criteria by their effect on acquisition, activation and revenue. Together they make your overall audit score.</p>
            <div className="mt-14 grid lg:grid-cols-2 gap-8">
              {[
                { title: "Executive UX & UI", share: "60%", dot: "bg-accent", items: SUB_SCORES.map((x) => ({ key: x.key, label: x.label, weight: x.weight })) },
                { title: "AI & search visibility", share: "40%", dot: "bg-[#14b8a6]", items: VISIBILITY_SUB_SCORES.map((x) => ({ key: x.key, label: x.label, weight: x.weight })) },
              ].map((p, pi) => (
                <Reveal key={p.title} delay={pi * 100} className="rounded-3xl border border-line bg-white p-6 sm:p-8 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2.5 text-xl font-semibold"><span className={`h-3 w-3 rounded-full ${p.dot}`} />{p.title}</h3>
                    <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold text-muted">{p.share} of overall</span>
                  </div>
                  <ul className="mt-6 space-y-4">
                    {p.items.map((x, i) => (
                      <li key={x.key}>
                        <div className="flex items-baseline justify-between gap-3 text-[15px]">
                          <span className="font-medium">{x.label}</span>
                          <span className="tabular-nums text-sm font-semibold text-muted">{Math.round(x.weight * 100)}%</span>
                        </div>
                        <div className="mt-1.5 h-2 rounded-full bg-surface-2">
                          <div className={`bar-grow h-2 rounded-full ${p.dot}`} style={{ width: `${x.weight * 400}%`, ["--bar-delay" as string]: `${200 + i * 70}ms` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-6xl px-5 sm:px-6 py-16 sm:py-24 scroll-mt-16">
          <h2 className="text-center text-3xl md:text-4xl font-bold tracking-tight">Simple pricing</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-muted">Start with a free scan. Go Pro for the full report and unlimited scans.</p>
          <div className="mx-auto mt-14 grid md:grid-cols-2 gap-6 max-w-4xl">
            {PRICING.map((p, i) => (
              <Reveal key={p.key} delay={i * 100} className={`lift relative rounded-2xl border bg-white p-9 ${p.highlighted ? "border-accent shadow-[0_20px_50px_rgb(91_69_255/0.15)]" : "border-line shadow-sm"}`}>
                {p.highlighted && (
                  <span className="absolute -top-3 left-9 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">Full report</span>
                )}
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-5 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold tracking-tight">{p.price}</span>
                  <span className="text-muted">{p.cadence}</span>
                </p>
                <p className="mt-3 text-muted">{p.description}</p>
                <ul className="mt-7 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-3">
                      <svg viewBox="0 0 20 20" className={`mt-0.5 h-5 w-5 shrink-0 ${p.highlighted ? "text-accent" : "text-good"}`} fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 10.5l3.2 3.2L15 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <ButtonLink href={p.key === "pro" ? "/upgrade" : "/signup"} variant={p.highlighted ? "accent" : "secondary"} className="mt-9 w-full py-3 text-base">
                  {p.cta}
                </ButtonLink>
              </Reveal>
            ))}
          </div>
          <p className="mt-8 text-center text-muted">
            Need a senior strategist? Executive human audits by Matan.Design are available from every report.
          </p>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-6">
          <Reveal className="rounded-3xl bg-gradient-to-br from-accent to-[#7a3cff] px-6 py-12 sm:px-8 sm:py-16 md:px-16 text-center text-white">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">See what’s holding your product back</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">Your first audit is free and takes about two minutes.</p>
            <div className="mx-auto mt-9 max-w-xl text-left">
              <HeroAuditForm signedIn={Boolean(user)} size="md" />
            </div>
            <a href="/sample" className="mt-6 inline-block text-white/90 font-medium underline underline-offset-4 hover:text-white">or view a sample report first</a>
          </Reveal>
        </section>
      </main>
    </>
  );
}

function HeroPreview() {
  const counts = [
    { label: "Critical", n: 3, cls: "bg-critical" },
    { label: "High", n: 4, cls: "bg-high" },
    { label: "Medium", n: 5, cls: "bg-medium" },
  ];
  return (
    <div className="rounded-2xl border border-line bg-white shadow-[0_30px_80px_rgb(14_19_37/0.12)] overflow-hidden text-left">
      <div className="flex items-center gap-1.5 border-b border-line bg-surface px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-critical/70" />
        <span className="h-3 w-3 rounded-full bg-high/70" />
        <span className="h-3 w-3 rounded-full bg-good/70" />
        <span className="ml-3 text-xs text-subtle">acme-insights.example · Growth Readiness Report</span>
      </div>
      <div className="grid md:grid-cols-[auto_1fr] gap-6 sm:gap-8 p-5 sm:p-8 items-center border-b border-line">
        <div className="flex justify-center"><ScoreRing score={48} size={150} stroke={13} /></div>
        <div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {counts.map((c) => (
              <div key={c.label} className="rounded-xl border border-line p-3 sm:p-4">
                <div className="flex items-center gap-2 text-sm text-muted"><span className={`h-2.5 w-2.5 rounded-full ${c.cls}`} />{c.label}</div>
                <p className="mt-1 text-3xl font-bold">{c.n}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {[["Value proposition", 41, "bg-critical"], ["Onboarding", 38, "bg-critical"], ["Conversion path", 52, "bg-critical"]].map(([l, v, c]) => (
              <div key={l as string} className="flex items-center gap-4 text-sm">
                <span className="w-28 sm:w-36 shrink-0 text-muted">{l}</span>
                <div className="h-2 flex-1 rounded-full bg-surface-2"><div className={`bar-grow h-2 rounded-full ${c}`} style={{ width: `${v}%`, ["--bar-delay" as string]: "700ms" }} /></div>
                <span className="w-8 text-right font-semibold tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-[1.3fr_1fr] gap-6 sm:gap-8 p-5 sm:p-8 items-center">
        <div className="relative rounded-xl overflow-hidden border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sample/home.png" alt="Annotated landing page" className="block w-full" />
          <div className="marker-pop absolute rounded-md border-[3px] border-critical bg-critical/10" style={{ left: "2.5%", top: "16%", width: "49%", height: "25%" }}>
            <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-critical text-xs font-bold text-white flex items-center justify-center shadow">1</span>
          </div>
        </div>
        <div>
          <span className="inline-flex rounded-full bg-critical px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white">Critical</span>
          <p className="mt-3 text-xl font-semibold leading-snug">Headline describes a category, not an outcome</p>
          <p className="mt-3 text-muted leading-relaxed">Visitors cannot tell what changes for them. This suppresses signup conversion on every paid and organic visit.</p>
          <p className="mt-4 text-sm font-semibold text-good">Fix: lead with the outcome and buyer in under ten words.</p>
        </div>
      </div>
    </div>
  );
}
