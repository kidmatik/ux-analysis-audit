"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Three connected step cards. The active step cycles while the section is on screen;
// hovering, focusing or tapping a card takes over, and each card has its own mini demo.

type Tone = { text: string; bg: string; ring: string; fill: string };
const TONES: Tone[] = [
  { text: "text-accent", bg: "bg-accent/10", ring: "ring-accent/40", fill: "var(--color-accent)" },
  { text: "text-medium", bg: "bg-medium/10", ring: "ring-medium/40", fill: "var(--color-medium)" },
  { text: "text-good", bg: "bg-good/10", ring: "ring-good/40", fill: "var(--color-good)" },
];

const STEPS = [
  {
    title: "Share your product",
    body: "Paste a live URL, or share a demo login, a Figma file or a screen recording. Credentials are encrypted and deleted after analysis.",
  },
  {
    title: "We scan every screen",
    body: "Each screen is reviewed like a senior UX lead would, while your pages are crawled for SEO and GEO: indexing, AI crawler access and structured data.",
  },
  {
    title: "Fix what matters first",
    body: "Get your Growth Readiness Score, issues pinned on screen and a plan ranked by impact. Tick a fix below to see the score climb.",
  },
];

const CYCLE_MS = 5200;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return reduced;
}

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(false);
  const [held, setHeld] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "-25% 0px -25% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || held || reduced) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % 3), CYCLE_MS);
    return () => clearTimeout(t);
  }, [active, inView, held, reduced]);

  const take = (i: number) => {
    setActive(i);
    setHeld(true);
  };

  return (
    <div ref={ref} className="mt-14 grid gap-4 lg:grid-cols-[1fr_3.5rem_1fr_3.5rem_1fr] lg:gap-0" onMouseLeave={() => setHeld(false)}>
      {STEPS.map((s, i) => (
        <StepFragment key={s.title} i={i} last={i === STEPS.length - 1} lit={active > i} active={active === i} inView={inView} reduced={reduced}>
          <article
            tabIndex={0}
            onMouseEnter={() => take(i)}
            onFocus={() => take(i)}
            onClick={() => take(i)}
            aria-current={active === i ? "step" : undefined}
            className={`group relative flex flex-col rounded-3xl border bg-white p-6 text-left outline-none transition duration-500 focus-visible:ring-4 ${TONES[i].ring} ${
              active === i ? `border-transparent shadow-[0_24px_60px_rgb(14_19_37/0.12)] ring-2 lg:-translate-y-1.5` : "border-line shadow-sm"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`relative grid h-12 w-12 place-items-center rounded-2xl ${TONES[i].bg} ${TONES[i].text}`}>
                {active === i && !reduced && <span className="absolute inset-0 rounded-2xl ring-2 ring-current opacity-60 animate-ping [animation-duration:2s]" />}
                <StepIcon i={i} />
              </span>
              <span className={`text-xs font-semibold uppercase tracking-[0.14em] ${TONES[i].text}`}>Step {i + 1}</span>
            </div>
            <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
            <p className="mt-2 text-muted leading-relaxed">{s.body}</p>
            <div className="mt-6 flex-1 rounded-2xl border border-line bg-surface p-4">
              {i === 0 && <ShareDemo active={active === 0 && inView} reduced={reduced} />}
              {i === 1 && <ScanDemo active={active === 1 && inView} reduced={reduced} />}
              {i === 2 && <FixDemo active={active === 2 && inView} reduced={reduced} onUse={() => take(2)} />}
            </div>
            <div className="mt-5 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
              {active === i && (
                <div
                  key={`${active}-${held}`}
                  className="h-full rounded-full"
                  style={{ background: TONES[i].fill, animation: held || reduced || !inView ? undefined : `hiw-progress ${CYCLE_MS}ms linear both`, width: held || reduced ? "100%" : undefined }}
                />
              )}
            </div>
          </article>
        </StepFragment>
      ))}
    </div>
  );
}

function StepFragment({ children, i, last, lit, active, inView, reduced }: { children: React.ReactNode; i: number; last: boolean; lit: boolean; active: boolean; inView: boolean; reduced: boolean }) {
  return (
    <>
      {children}
      {!last && <Connector from={TONES[i].fill} to={TONES[i + 1].fill} lit={lit} flowing={active && inView && !reduced} />}
    </>
  );
}

/** The link between two cards: dashes flow toward the next step while the current one runs, then the line fills in. */
function Connector({ from, to, lit, flowing }: { from: string; to: string; lit: boolean; flowing: boolean }) {
  return (
    <div className="hiw-conn relative flex items-center justify-center py-1 lg:py-0" aria-hidden="true">
      <div className="relative h-10 w-0.5 lg:h-0.5 lg:w-full">
        <div className="hiw-dash absolute inset-0 text-line-strong" data-flowing={flowing || undefined} />
        <div
          className="absolute inset-0 origin-top rounded-full transition-transform duration-700 lg:origin-left"
          style={{ background: `linear-gradient(var(--hiw-dir, 180deg), ${from}, ${to})`, transform: lit ? "scale(1)" : "var(--hiw-collapsed)" }}
        />
      </div>
      <span
        className={`absolute grid h-7 w-7 place-items-center rounded-full border bg-white transition-colors duration-500 ${lit ? "border-transparent text-white" : "border-line text-subtle"}`}
        style={{ background: lit ? to : undefined }}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 rotate-90 lg:rotate-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      </span>
    </div>
  );
}

function StepIcon({ i }: { i: number }) {
  const common = { viewBox: "0 0 24 24", className: "relative h-6 w-6", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (i === 0)
    return (
      <svg {...common}>
        <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
      </svg>
    );
  if (i === 1)
    return (
      <svg {...common}>
        <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
        <path d="M4 12h16" />
        <path d="M8 8.5h5M8 15.5h8" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M4 19V9M10 19V5M16 19v-6M22 19H2" />
      <path d="m14 7 2-2 3 3" />
    </svg>
  );
}

const SOURCES = [
  { label: "URL", value: "acme-insights.com" },
  { label: "Demo login", value: "demo@acme-insights.com" },
  { label: "Figma", value: "figma.com/file/acme-onboarding" },
  { label: "Recording", value: "onboarding-walkthrough.mp4" },
];

/** Step 1: pick a source and watch it get typed in. */
function ShareDemo({ active, reduced }: { active: boolean; reduced: boolean }) {
  const [src, setSrc] = useState(0);
  const [typed, setTyped] = useState(0);
  const value = SOURCES[src].value;

  useEffect(() => {
    if (reduced) return setTyped(value.length);
    if (!active) return;
    setTyped(0);
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      setTyped(n);
      if (n >= value.length) clearInterval(t);
    }, 55);
    return () => clearInterval(t);
  }, [active, value, reduced]);

  // While the card is running on its own, move through the sources.
  useEffect(() => {
    if (!active || reduced) return;
    const t = setTimeout(() => setSrc((s) => (s + 1) % SOURCES.length), 2600);
    return () => clearTimeout(t);
  }, [active, src, reduced]);

  const done = typed >= value.length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose what to audit">
        {SOURCES.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSrc(i);
            }}
            aria-pressed={src === i}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${src === i ? "bg-accent text-white" : "bg-white text-muted ring-1 ring-line hover:text-fg"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 ring-1 ring-line">
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-fg">
          {value.slice(0, typed)}
          <span className={`ml-px inline-block h-4 w-px translate-y-0.5 bg-accent ${done ? "animate-pulse" : ""}`} />
        </span>
        <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-white transition ${done ? "bg-cta" : "bg-line-strong"}`}>Audit</span>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-subtle">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-good" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="7" width="10" height="7" rx="1.5" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
        </svg>
        Encrypted, deleted after the audit
      </p>
    </div>
  );
}

const SCAN_ITEMS = ["Screens captured", "UX heuristics", "Pages crawled", "AI crawler access", "Structured data"];

/** Step 2: a page gets swept while the checklist fills in. */
function ScanDemo({ active, reduced }: { active: boolean; reduced: boolean }) {
  const [done, setDone] = useState(reduced ? SCAN_ITEMS.length : 0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (reduced) return setDone(SCAN_ITEMS.length);
    if (!active) return;
    setDone(0);
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      setDone(n);
      if (n >= SCAN_ITEMS.length) clearInterval(t);
    }, 750);
    return () => clearInterval(t);
  }, [active, run, reduced]);

  const scanning = active && !reduced && done < SCAN_ITEMS.length;
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-4">
      <div className="relative h-[8.5rem] overflow-hidden rounded-lg bg-white ring-1 ring-line">
        <div className="space-y-1.5 p-2">
          <div className="h-1.5 w-10 rounded bg-line-strong" />
          <div className={`h-3 w-full rounded transition ${done > 1 ? "bg-critical/20 ring-1 ring-critical" : "bg-surface-2"}`} />
          <div className="h-1.5 w-4/5 rounded bg-surface-2" />
          <div className="flex gap-1">
            <div className="h-3 w-7 rounded bg-medium/40" />
            <div className={`h-3 w-7 rounded transition ${done > 2 ? "bg-high/30 ring-1 ring-high" : "bg-surface-2"}`} />
          </div>
          <div className="grid grid-cols-2 gap-1 pt-1">
            {[0, 1, 2, 3].map((k) => (
              <div key={k} className="h-5 rounded bg-surface" />
            ))}
          </div>
        </div>
        {scanning && <div className="hiw-scan absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-medium/25 to-transparent" />}
      </div>
      <ul className="space-y-1.5 text-[13px]">
        {SCAN_ITEMS.map((item, k) => {
          const ok = k < done;
          const now = k === done && scanning;
          return (
            <li key={item} className="flex items-center gap-2">
              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full transition ${ok ? "bg-good text-white" : now ? "bg-medium/15" : "bg-surface-2"}`}>
                {ok ? (
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m2.5 6.2 2.2 2.2 4.8-5" />
                  </svg>
                ) : now ? (
                  <span className="h-2 w-2 animate-ping rounded-full bg-medium" />
                ) : null}
              </span>
              <span className={ok ? "text-fg" : "text-subtle"}>{item}</span>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRun((r) => r + 1);
            }}
            className="mt-1 text-xs font-semibold text-medium hover:underline"
          >
            Run the scan again
          </button>
        </li>
      </ul>
    </div>
  );
}

const FIXES = [
  { label: "Rewrite the hero headline", pts: 14, tag: "Critical" },
  { label: "Cut sign-up to 3 fields", pts: 11, tag: "High" },
  { label: "Unblock GPTBot in robots.txt", pts: 8, tag: "AI search" },
];
const BASE_SCORE = 48;

/** Step 3: tick fixes and the score climbs. Runs one fix on its own to show the idea. */
function FixDemo({ active, reduced, onUse }: { active: boolean; reduced: boolean; onUse: () => void }) {
  const [on, setOn] = useState<boolean[]>([false, false, false]);
  const [touched, setTouched] = useState(false);
  const target = BASE_SCORE + FIXES.reduce((sum, f, i) => sum + (on[i] ? f.pts : 0), 0);
  const [shown, setShown] = useState(BASE_SCORE);
  const shownRef = useRef(BASE_SCORE);
  shownRef.current = shown;

  useEffect(() => {
    if (!active || touched || reduced) return;
    setOn([false, false, false]);
    const timers = [setTimeout(() => setOn([true, false, false]), 900), setTimeout(() => setOn([true, true, false]), 2100), setTimeout(() => setOn([true, true, true]), 3300)];
    return () => timers.forEach(clearTimeout);
  }, [active, touched, reduced]);

  const animateTo = useCallback(
    (to: number) => {
      if (reduced) return setShown(to);
      let raf = 0;
      const from = shownRef.current;
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / 600);
        setShown(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    },
    [reduced],
  );
  useEffect(() => animateTo(target), [target, animateTo]);

  const tone = shown >= 80 ? "var(--color-good)" : shown >= 60 ? "var(--color-high)" : "var(--color-critical)";
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-subtle">Growth Readiness</p>
          <p className="text-3xl font-extrabold tabular-nums tracking-tight" style={{ color: tone }}>
            {shown}
            <span className="text-base font-semibold text-subtle">/100</span>
          </p>
        </div>
        <p className={`rounded-full px-2 py-0.5 text-xs font-semibold transition ${target > BASE_SCORE ? "bg-good/10 text-good" : "bg-surface-2 text-subtle"}`}>+{target - BASE_SCORE} pts</p>
      </div>
      <div className="h-2 rounded-full bg-surface-2">
        <div className="h-2 rounded-full transition-[width] duration-700" style={{ width: `${shown}%`, background: tone }} />
      </div>
      <ul className="space-y-1.5">
        {FIXES.map((f, i) => (
          <li key={f.label}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[13px] ring-1 ring-line transition hover:ring-good/50" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={on[i]}
                onChange={() => {
                  onUse();
                  setTouched(true);
                  setOn((prev) => prev.map((v, k) => (k === i ? !v : v)));
                }}
                className="h-3.5 w-3.5 accent-[var(--color-good)]"
              />
              <span className={`min-w-0 flex-1 truncate ${on[i] ? "text-subtle line-through" : ""}`}>{f.label}</span>
              <span className="shrink-0 text-xs font-semibold text-good">+{f.pts}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
