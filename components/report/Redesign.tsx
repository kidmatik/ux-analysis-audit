"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { UpgradeButton } from "../UpgradeButton";
import { btn } from "../ui";
import { PanelTitle } from "./PanelTitle";
import { SAMPLE_REDESIGN_HEIGHT } from "@/lib/sample-redesign";
import { REDESIGN_STAGES, colorOf, contrast, styleguideCss, typeOf, type RedesignPlan, type RedesignView } from "@/lib/redesign";

type Props = {
  auditId: string;
  productName: string;
  initial: RedesignView | null;
  mode: "owner" | "shared" | "sample";
  locked: boolean;
  currentScore: number;
  findingTitles: Record<string, string>;
};

const ROLE_LABEL: Record<string, string> = {
  headline: "Headline",
  subheadline: "Subheadline",
  primary_cta: "Primary CTA",
  secondary_cta: "Secondary CTA",
  section_heading: "Section heading",
  body: "Body copy",
  form_button: "Form button",
};

const AREA_STYLE: Record<string, string> = {
  copy: "bg-accent/10 text-accent",
  hierarchy: "bg-medium/10 text-medium",
  cta: "bg-cta/10 text-cta",
  contrast: "bg-good/10 text-good",
  typography: "bg-[#ff7a2e]/10 text-[#ff7a2e]",
  spacing: "bg-surface-2 text-muted",
  trust: "bg-high/10 text-high",
  layout: "bg-surface-2 text-muted",
};

const fontsHref = (plan: RedesignPlan) =>
  `https://fonts.googleapis.com/css2?${Array.from(new Set([plan.styleguide.fonts.heading, plan.styleguide.fonts.body]))
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800`)
    .join("&")}&display=swap`;

export function Redesign({ auditId, productName, initial, mode, locked, currentScore, findingTitles }: Props) {
  const [data, setData] = useState<RedesignView | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const poll = useCallback(async () => {
    const res = await fetch(`/api/audits/${auditId}/redesign`, { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as RedesignView | null;
    if (json && json.status) setData(json);
  }, [auditId]);

  useEffect(() => {
    if (data?.status !== "processing") return;
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, [data?.status, poll]);

  async function start() {
    setStarting(true);
    setError(null);
    const res = await fetch(`/api/audits/${auditId}/redesign`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setStarting(false);
    if (!res.ok) return setError(json.error ?? "Could not start the redesign.");
    setData(json);
  }

  if (locked) return <LockedTeaser productName={productName} />;
  if (!data) return mode === "owner" ? <StartCard productName={productName} onStart={start} starting={starting} error={error} /> : null;
  if (data.status === "processing") return <Progress stage={data.stage} productName={productName} />;
  if (data.status === "failed" || !data.plan) {
    return (
      <div className="rounded-3xl border border-critical/30 bg-critical/5 p-6 sm:p-10 text-center">
        <p className="text-lg font-semibold">The redesign did not finish</p>
        <p className="mt-2 text-muted">{data.error || "Something went wrong while applying the changes."}</p>
        {mode === "owner" && <button onClick={start} disabled={starting} className={`${btn("accent")} mt-5`}>{starting ? "Starting" : "Run it again"}</button>}
        {error && <p className="mt-3 text-sm text-critical">{error}</p>}
      </div>
    );
  }
  return <Result data={data} plan={data.plan} mode={mode} currentScore={currentScore} findingTitles={findingTitles} onRegenerate={start} starting={starting} />;
}

function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zm7 11l.9 2.6 2.6.9-2.6.9L19 20l-.9-2.6-2.6-.9 2.6-.9L19 13z" />
    </svg>
  );
}

const PROMISES = [
  { t: "Your page, rebuilt", d: "Every fix from this report applied to your live page, not a generic template." },
  { t: "Copy that converts", d: "Outcome-led headline, a one-line subheadline and buttons that say what happens next." },
  { t: "A new styleguide", d: "Type scale, accessible palette, buttons and voice rules, ready to hand to your team." },
  { t: "Before and after", d: "Drag the slider to compare, then open or download the redesigned page." },
];

function StartCard({ productName, onStart, starting, error }: { productName: string; onStart: () => void; starting: boolean; error: string | null }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-accent/25 bg-white p-6 sm:p-12 shadow-[0_10px_40px_rgb(240_74_15/0.10)]">
      <div className="hero-glow pointer-events-none absolute inset-0" />
      <div className="relative grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent"><Sparkle className="h-3.5 w-3.5" />One-click Redesign</span>
          <h2 className="mt-4 text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.05]">See {productName} with every fix applied.</h2>
          <p className="mt-4 text-lg text-muted leading-relaxed">We rebuild your page with the report&apos;s changes: rewritten copy, a clear call to action and a new styleguide, then show you the before and after.</p>
          <button onClick={onStart} disabled={starting} className="mt-7 inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-accent to-[#ff7a2e] px-7 py-4 text-lg font-bold text-white shadow-[0_14px_30px_-10px_rgb(240_74_15/0.7)] transition-transform hover:-translate-y-0.5 disabled:opacity-60">
            <Sparkle className="h-5 w-5" />
            {starting ? "Starting your redesign" : "Redesign my page in one click"}
          </button>
          {error && <p className="mt-3 text-sm text-critical">{error}</p>}
        </div>
        <ul className="grid sm:grid-cols-2 gap-3">
          {PROMISES.map((p) => (
            <li key={p.t} className="rounded-2xl border border-line bg-white/80 p-4">
              <p className="font-semibold">{p.t}</p>
              <p className="mt-1 text-sm text-muted leading-relaxed">{p.d}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LockedTeaser({ productName }: { productName: string }) {
  return (
    <div className="rounded-3xl border border-accent/25 bg-white p-6 sm:p-10 shadow-sm">
      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent"><Sparkle className="h-3.5 w-3.5" />Pro · One-click Redesign</span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">See {productName} redesigned in one click.</h2>
          <p className="mt-3 text-muted leading-relaxed">Pro rebuilds your page with every fix applied, rewrites the headline and calls to action, and generates a styleguide that matches the report. Drag to compare before and after.</p>
          <div className="mt-6"><UpgradeButton label="Go Pro to redesign, $39/month" /></div>
        </div>
        <div>
          <BeforeAfter before={{ src: "/sample/redesign-before.png", width: 1440, height: SAMPLE_REDESIGN_HEIGHT }} after={{ src: "/sample/redesign-after.png", width: 1440, height: SAMPLE_REDESIGN_HEIGHT }} maxHeight={420} />
          <p className="mt-2 text-center text-xs text-subtle">Example from the Acme Insights sample report</p>
        </div>
      </div>
    </div>
  );
}

function Progress({ stage, productName }: { stage: number; productName: string }) {
  return (
    <div className="rounded-3xl border border-line bg-white p-6 sm:p-12 shadow-sm">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-3">
          <span className="pulse-ring flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white"><Sparkle className="h-5 w-5" /></span>
          <div>
            <p className="text-xl font-bold">Redesigning {productName}</p>
            <p className="text-sm text-muted">This usually takes under a minute. You can keep reading the report.</p>
          </div>
        </div>
        <ol className="mt-8 space-y-3">
          {REDESIGN_STAGES.map((s, i) => {
            const state = i < stage ? "done" : i === stage ? "active" : "todo";
            return (
              <li key={s} className={`relative flex items-center gap-3 overflow-hidden rounded-xl border px-4 py-3 ${state === "active" ? "shimmer border-accent/40 bg-accent/5" : "border-line"}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${state === "done" ? "bg-good text-white" : state === "active" ? "bg-accent text-white" : "bg-surface-2 text-subtle"}`}>
                  {state === "done" ? "✓" : i + 1}
                </span>
                <span className={state === "todo" ? "text-subtle" : "font-medium"}>{s}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

type Img = { src: string; width: number; height: number };

export function BeforeAfter({ before, after, pins = [], showPins = false, maxHeight, mode = "split" }: { before: Img; after: Img; pins?: { label: string; x: number; y: number; w: number; h: number }[]; showPins?: boolean; maxHeight?: number; mode?: "split" | "before" | "after" }) {
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const shown = mode === "before" ? 100 : mode === "after" ? 0 : pos;
  const fromX = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (r) setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_10px_40px_rgb(14_19_37/0.08)]" style={maxHeight ? { maxHeight } : undefined}>
      <div
        ref={box}
        className="relative w-full select-none"
        style={{ aspectRatio: `${after.width} / ${after.height}`, touchAction: "pan-y" }}
        onPointerDown={(e) => mode === "split" && e.pointerType === "mouse" && fromX(e.clientX)}
        onPointerMove={(e) => drag.current && fromX(e.clientX)}
        onPointerUp={() => (drag.current = false)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after.src} alt="After the redesign" className="absolute inset-0 h-full w-full object-cover object-top" draggable={false} />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - shown}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before.src} alt="Before the redesign" className="absolute inset-0 h-full w-full object-cover object-top" draggable={false} />
        </div>
        {showPins &&
          pins.map((p) => (
            <div key={p.label} className="pointer-events-none absolute rounded-md border-[2.5px] border-good bg-good/10 transition-opacity" style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%`, opacity: p.x + p.w / 2 > shown ? 1 : 0.15 }}>
              <span className="marker-pop absolute -left-3 -top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-good px-1 text-[11px] font-bold text-white shadow">{p.label}</span>
            </div>
          ))}
        {mode === "split" && (
          <>
            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-fg/80 px-3 py-1 text-xs font-semibold text-white">Before</span>
            <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">After</span>
            <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgb(14_19_37/0.15)]" style={{ left: `${pos}%` }} />
            <div
              role="slider"
              tabIndex={0}
              aria-label="Compare before and after"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pos)}
              onPointerDown={(e) => {
                e.stopPropagation();
                drag.current = true;
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => drag.current && fromX(e.clientX)}
              onPointerUp={() => (drag.current = false)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5));
                if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5));
              }}
              className="absolute z-10 flex h-12 w-12 -translate-x-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-accent shadow-[0_6px_20px_rgb(14_19_37/0.25)] ring-4 ring-accent/20 focus:outline-none focus-visible:ring-accent"
              style={{ left: `${pos}%`, top: maxHeight ? Math.min(maxHeight / 2, 220) : "min(50%, 220px)", touchAction: "none" }}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l-6 6 6 6M15 6l6 6-6 6" /></svg>
            </div>
          </>
        )}
      </div>
      {maxHeight && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />}
    </div>
  );
}

function FindingChip({ id, titles }: { id: string | null; titles: Record<string, string> }) {
  if (!id || !titles[id]) return null;
  return (
    <a href={`#finding-${id}`} className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-white px-2.5 py-0.5 text-xs text-muted hover:border-accent hover:text-accent">
      <span className="font-semibold">{id}</span>
      <span className="truncate">{titles[id]}</span>
    </a>
  );
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Result({ data, plan, mode, currentScore, findingTitles, onRegenerate, starting }: { data: RedesignView; plan: RedesignPlan; mode: Props["mode"]; currentScore: number; findingTitles: Record<string, string>; onRegenerate: () => void; starting: boolean }) {
  const [view, setView] = useState<"split" | "before" | "after">("split");
  const [showPins, setShowPins] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const pins = (data.pins ?? []).map((p) => ({ ...p, label: String(p.copyIndex + 1) }));
  const sg = plan.styleguide;
  const primary = colorOf(plan, "primary", "#4f46e5");
  const onPrimary = colorOf(plan, "on_primary", "#ffffff");
  const ink = colorOf(plan, "ink", "#111827");
  const muted = colorOf(plan, "muted", "#4b5563");
  const bg = colorOf(plan, "background", "#ffffff");
  const surface = colorOf(plan, "surface", "#f5f6fb");
  const headline = plan.copy.find((c) => c.role === "headline")?.after ?? `${data.current?.headings[0] ?? "Your outcome-led headline"}`;
  const sub = plan.copy.find((c) => c.role === "subheadline")?.after ?? "One sentence that says how you deliver it.";
  const primaryCta = plan.copy.find((c) => c.role === "primary_cta")?.after ?? plan.ctas.primary ?? "Get started";
  const secondaryCta = plan.copy.find((c) => c.role === "secondary_cta")?.after ?? plan.ctas.secondary;
  const lift = plan.projectedScore - currentScore;
  const headingFont = `"${sg.fonts.heading}", ui-sans-serif, system-ui, sans-serif`;
  const bodyFont = `"${sg.fonts.body}", ui-sans-serif, system-ui, sans-serif`;
  const cur = data.current;
  const display = typeOf(plan, "display");

  const compare = [
    cur?.h1 && display ? { label: "Headline", was: `${Math.round(cur.h1.size)}px · ${cur.h1.weight}`, now: `${display.size}px · ${display.weight}` } : null,
    cur ? { label: "Heading font", was: cur.headingFont, now: sg.fonts.heading } : null,
    cur?.buttons[0] ? { label: "Primary button", was: cur.buttons[0].background, now: primary, swatch: true } : null,
    cur ? { label: "Body line height", was: cur.body.lineHeight.toFixed(2), now: String(typeOf(plan, "body")?.lineHeight ?? "") } : null,
    plan.ctas.remove.length ? { label: "Hero actions", was: String(plan.ctas.remove.length + (plan.ctas.primary ? 1 : 0) + (plan.ctas.secondary ? 1 : 0)), now: String((plan.ctas.primary ? 1 : 0) + (plan.ctas.secondary ? 1 : 0)) } : null,
  ].filter(Boolean) as { label: string; was: string; now: string; swatch?: boolean }[];

  return (
    <div className="space-y-10">
      <link rel="stylesheet" href={fontsHref(plan)} precedence="default" />

      {/* Summary */}
      <div className="relative overflow-hidden rounded-3xl bg-fg p-6 sm:p-10 text-white">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/40 blur-3xl" />
        <div className="relative grid lg:grid-cols-[1.5fr_1fr] gap-8 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#ffb48f]"><Sparkle className="h-3.5 w-3.5" />One-click Redesign</span>
            <h2 className="mt-4 text-2xl sm:text-4xl font-extrabold tracking-tight">Your page, with every fix applied.</h2>
            <p className="mt-3 text-white/75 leading-relaxed">{plan.summary}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-white/10 px-3 py-1">{plan.copy.length} copy rewrites</span>
              <span className="rounded-full bg-white/10 px-3 py-1">{plan.changes.length} design changes</span>
              <span className="rounded-full bg-white/10 px-3 py-1">New styleguide: {sg.name}</span>
            </div>
          </div>
          <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
            <p className="text-sm text-white/60">Projected UX score</p>
            <div className="mt-2 flex items-end gap-3">
              <span className="text-3xl font-bold text-white/50 line-through decoration-2">{currentScore}</span>
              <svg viewBox="0 0 24 24" className="mb-2 h-6 w-6 text-[#ffb48f]" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              <span className="text-6xl font-extrabold tracking-tight text-[#6ee7b7]">{plan.projectedScore}</span>
            </div>
            {lift > 0 && <p className="mt-1 text-sm text-[#6ee7b7]">+{lift} points if these changes ship</p>}
            <p className="mt-3 text-xs text-white/50">An estimate from the findings this redesign addresses. Validate with an A/B test.</p>
          </div>
        </div>
      </div>

      {/* Before / after */}
      <section>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <PanelTitle title="Before and after" sub="Drag the handle to compare. Green numbers mark the copy that changed." />
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="View" className="inline-flex rounded-xl border border-line bg-white p-1">
              {(["before", "split", "after"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`rounded-lg px-3.5 py-1.5 text-sm capitalize transition-colors ${view === v ? "bg-accent text-white font-semibold" : "text-muted hover:text-fg"}`}>
                  {v === "split" ? "Compare" : v}
                </button>
              ))}
            </div>
            {pins.length > 0 && (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm">
                <input type="checkbox" checked={showPins} onChange={(e) => setShowPins(e.target.checked)} className="accent-[#10b981]" />
                Show changes
              </label>
            )}
          </div>
        </div>
        <div className="mt-6">
          {data.before && data.after ? (
            <>
              <BeforeAfter before={data.before} after={data.after} pins={pins} showPins={showPins} mode={view} maxHeight={expanded ? undefined : 760} />
              <div className="mt-3 text-center">
                <button onClick={() => setExpanded((x) => !x)} className="text-sm font-semibold text-accent hover:underline underline-offset-4">{expanded ? "Collapse" : "Show the full page"}</button>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-6 text-center text-muted">
              {data.notes?.[0] ?? "The visual preview needs a public URL."} The copy and styleguide below are ready to use.
            </div>
          )}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 no-print">
          {data.htmlSrc && (
            <>
              <a href={data.htmlSrc} target="_blank" rel="noopener" className={btn("accent")}>Open the redesigned page</a>
              <a href={`${data.htmlSrc}${data.htmlSrc.includes("?") ? "&" : "?"}download=1`} download="redesigned-page.html" className={btn("secondary")}>Download HTML</a>
            </>
          )}
          <button onClick={() => download(`${sg.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-tokens.css`, styleguideCss(plan), "text/css")} className={btn("secondary")}>Download styleguide (CSS tokens)</button>
          {mode === "owner" && <button onClick={onRegenerate} disabled={starting} className={btn("ghost")}>{starting ? "Starting" : "Regenerate"}</button>}
        </div>
      </section>

      {/* Copy */}
      <section>
        <PanelTitle title="Copy changes" sub="Rewritten from the report's insights. The numbers match the markers on the after image." />
        <ol className="mt-6 grid gap-4 [&>*]:min-w-0">
          {plan.copy.map((c, i) => (
            <li key={i} className="rounded-2xl border border-line bg-white p-5 sm:p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-good text-sm font-bold text-white">{i + 1}</span>
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted">{ROLE_LABEL[c.role] ?? c.role}</span>
                <FindingChip id={c.findingId} titles={findingTitles} />
              </div>
              <div className="mt-4 grid md:grid-cols-2 gap-4">
                <div className="rounded-xl bg-surface p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-subtle">Before</p>
                  <p className="mt-1.5 text-muted line-through decoration-critical/50">{c.before}</p>
                </div>
                <div className="rounded-xl border border-good/30 bg-good/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-good">After</p>
                  <p className={`mt-1.5 ${c.role === "headline" ? "text-2xl font-extrabold tracking-tight" : "text-lg font-semibold"}`}>{c.after}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted leading-relaxed">{c.why}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Styleguide */}
      <section>
        <PanelTitle title={`Styleguide: ${sg.name}`} sub="A design system built from your brand and the report's insights. Download it as CSS tokens for your team." />

        {/* Live specimen */}
        <div className="mt-6 overflow-hidden rounded-3xl border border-line shadow-sm" style={{ background: bg }}>
          <div className="p-6 sm:p-12" style={{ background: `linear-gradient(180deg, ${surface}, ${bg})` }}>
            <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: primary, fontFamily: bodyFont }}>Hero specimen</p>
            <p className="mt-3 max-w-[15ch]" style={{ fontFamily: headingFont, color: ink, fontSize: `clamp(34px, 6vw, ${display?.size ?? 60}px)`, fontWeight: display?.weight ?? 800, lineHeight: display?.lineHeight ?? 1.05, letterSpacing: `${display?.tracking ?? -0.03}em`, textWrap: "balance" }}>{headline}</p>
            <p className="mt-5 max-w-[34em]" style={{ fontFamily: bodyFont, color: muted, fontSize: typeOf(plan, "body_lg")?.size ?? 20, lineHeight: typeOf(plan, "body_lg")?.lineHeight ?? 1.55 }}>{sub}</p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <span className="inline-block" style={{ background: primary, color: onPrimary, borderRadius: sg.radius, padding: "16px 28px", fontFamily: bodyFont, fontWeight: typeOf(plan, "button")?.weight ?? 700, fontSize: typeOf(plan, "button")?.size ?? 17, boxShadow: `0 10px 24px -8px ${primary}99` }}>{primaryCta}</span>
              {secondaryCta && <span style={{ color: ink, fontFamily: bodyFont, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 5, textDecorationThickness: 2 }}>{secondaryCta}</span>}
            </div>
          </div>
        </div>

        <div className="mt-6 grid lg:grid-cols-2 gap-6 [&>*]:min-w-0">
          {/* Palette */}
          <div className="rounded-2xl border border-line bg-white p-5 sm:p-6 shadow-sm">
            <p className="font-semibold">Color</p>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {sg.colors.map((c) => {
                const onWhite = contrast(c.hex, "#ffffff");
                return (
                  <div key={c.role} className="min-w-0">
                    <div className="h-16 rounded-xl border border-line" style={{ background: c.hex }} />
                    <p className="mt-2 truncate text-sm font-semibold">{c.name}</p>
                    <p className="text-xs uppercase text-muted tabular-nums">{c.hex}</p>
                    <p className="text-[11px] text-subtle">{c.role.replace(/_/g, " ")}{onWhite >= 3 ? ` · ${onWhite.toFixed(1)}:1 ${onWhite >= 4.5 ? "AA" : "AA large"}` : ""}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Type scale */}
          <div className="rounded-2xl border border-line bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold">Typography</p>
              <p className="text-xs text-muted">{sg.fonts.heading} · {sg.fonts.body}</p>
            </div>
            <div className="mt-3 divide-y divide-line">
              {sg.type.map((t) => (
                <div key={t.token} className="flex items-baseline gap-4 py-2.5">
                  <span className="w-20 shrink-0 text-xs text-subtle">
                    <span className="block font-semibold text-muted">{t.token.replace(/_/g, " ")}</span>
                    {t.size}px / {t.weight}
                  </span>
                  <span className="min-w-0 truncate" style={{ fontFamily: ["display", "h2", "h3"].includes(t.token) ? headingFont : bodyFont, fontSize: Math.min(t.size, 40), fontWeight: t.weight, lineHeight: 1.2, letterSpacing: `${t.tracking}em`, color: ink }}>
                    {t.token === "button" ? primaryCta : t.token === "display" ? "Outcome first" : "Clear beats clever"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid lg:grid-cols-2 gap-6 [&>*]:min-w-0">
          <div className="rounded-2xl border border-line bg-white p-5 sm:p-6 shadow-sm">
            <p className="font-semibold">Voice rules</p>
            <ul className="mt-3 space-y-2.5">
              {sg.voice.map((v) => (
                <li key={v} className="flex gap-2.5 text-[15px]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: primary }} />{v}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted">Radius {sg.radius}px · spacing grid {sg.spacing}px</p>
          </div>
          {compare.length > 0 && (
            <div className="rounded-2xl border border-line bg-white p-5 sm:p-6 shadow-sm">
              <p className="font-semibold">Current vs new</p>
              <table className="mt-3 w-full table-fixed text-sm [&_td]:break-words">
                <tbody className="divide-y divide-line">
                  {compare.map((r) => (
                    <tr key={r.label}>
                      <td className="py-2.5 pr-3 text-muted">{r.label}</td>
                      <td className="py-2.5 pr-3 text-subtle line-through">{r.swatch && <Swatch c={r.was} />}{r.was}</td>
                      <td className="py-2.5 font-semibold">{r.swatch && <Swatch c={r.now} />}{r.now}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Change log */}
      <section>
        <PanelTitle title="Everything that changed" sub="Each change is tied to the finding it fixes." />
        <ul className="mt-6 grid md:grid-cols-2 gap-4 [&>*]:min-w-0">
          {plan.changes.map((c, i) => (
            <li key={i} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${AREA_STYLE[c.area] ?? "bg-surface-2 text-muted"}`}>{c.area}</span>
                <FindingChip id={c.findingId} titles={findingTitles} />
              </div>
              <p className="mt-3 font-semibold">{c.title}</p>
              <p className="mt-1 text-sm text-muted leading-relaxed">{c.detail}</p>
            </li>
          ))}
        </ul>
        {data.engine === "heuristic" && mode !== "sample" && (
          <p className="mt-5 text-xs text-subtle">Generated by the heuristic engine. With the AI engine enabled, copy is rewritten specifically for your product and audience.</p>
        )}
      </section>
    </div>
  );
}

function Swatch({ c }: { c: string }) {
  return <span className="mr-1.5 inline-block h-3 w-3 rounded-sm border border-line align-middle" style={{ background: c }} />;
}
