import { z } from "zod";

// One-click Redesign: the report's fixes applied to the live page, with rewritten copy and a
// new styleguide. The plan schema is shared by the Claude engine (structured output), the
// heuristic engine, the in-page apply step and the Redesign tab.

export const COPY_ROLES = ["headline", "subheadline", "primary_cta", "secondary_cta", "section_heading", "body", "form_button"] as const;
export const COLOR_ROLES = ["primary", "on_primary", "ink", "muted", "background", "surface", "accent", "success"] as const;
export const TYPE_TOKENS = ["display", "h2", "h3", "body_lg", "body", "small", "button"] as const;

export const RedesignPlanSchema = z.object({
  summary: z.string().describe("Two sentences: what the redesign changes and the effect it should have"),
  copy: z
    .array(
      z.object({
        role: z.enum(COPY_ROLES),
        before: z.string().describe("The exact current text, copied from the captured page data"),
        after: z.string().describe("The rewritten text"),
        why: z.string().describe("One sentence on why the new copy performs better"),
        findingId: z.string().nullable().describe("Id of the report finding this addresses, or null"),
      }),
    )
    .describe("Copy rewrites, most important first. Always include the main headline and every hero call to action that changes"),
  ctas: z.object({
    primary: z.string().nullable().describe("Exact current text of the one hero button to keep as the primary action"),
    secondary: z.string().nullable().describe("Exact current text of the hero action to keep as a quiet secondary link, or null"),
    remove: z.array(z.string()).describe("Exact current text of competing hero buttons to remove"),
  }),
  styleguide: z.object({
    name: z.string().describe("Short name for the new system, e.g. 'Acme Outcome UI'"),
    fonts: z.object({
      heading: z.string().describe("A Google Fonts family for headings"),
      body: z.string().describe("A Google Fonts family for body text"),
    }),
    colors: z
      .array(z.object({ role: z.enum(COLOR_ROLES), name: z.string(), hex: z.string().describe("#rrggbb") }))
      .describe("One color per role. Text colors must reach WCAG AA contrast on the background"),
    type: z
      .array(
        z.object({
          token: z.enum(TYPE_TOKENS),
          size: z.number().describe("px at desktop"),
          weight: z.number(),
          lineHeight: z.number().describe("unitless"),
          tracking: z.number().describe("letter-spacing in em"),
        }),
      )
      .describe("One entry per token"),
    radius: z.number().describe("Corner radius for buttons and cards, px"),
    spacing: z.number().describe("Base spacing unit, px"),
    voice: z.array(z.string()).describe("Three to five copy rules for the brand voice"),
  }),
  changes: z
    .array(
      z.object({
        area: z.enum(["copy", "hierarchy", "cta", "contrast", "typography", "spacing", "trust", "layout"]),
        title: z.string(),
        detail: z.string(),
        findingId: z.string().nullable(),
      }),
    )
    .describe("Every change the redesign applies, in plain language"),
  projectedScore: z.number().int().describe("Expected UX growth score (0-100) once these changes ship"),
});

export type RedesignPlan = z.infer<typeof RedesignPlanSchema>;
export type ColorRole = (typeof COLOR_ROLES)[number];
export type TypeToken = (typeof TYPE_TOKENS)[number];

// The page's design as captured, so the tab can show current vs new.
export type CurrentStyle = {
  headingFont: string;
  bodyFont: string;
  h1: { size: number; weight: number; lineHeight: number; color: string } | null;
  body: { size: number; lineHeight: number; color: string; background: string };
  buttons: { text: string; background: string; color: string; radius: number }[];
  heroParagraph: string;
  headings: string[];
};

export type Pin = { copyIndex: number; x: number; y: number; w: number; h: number };
type Shot = { assetId: string; width: number; height: number };

export type RedesignRecord = {
  status: "processing" | "complete" | "failed";
  stage: number;
  startedAt: string;
  error?: string;
  engine?: "claude" | "heuristic";
  plan?: RedesignPlan;
  current?: CurrentStyle | null;
  before?: Shot | null;
  after?: Shot | null;
  htmlAssetId?: string | null;
  pins?: Pin[];
  notes?: string[];
  generatedAt?: string;
};

export type RedesignView = Omit<RedesignRecord, "before" | "after" | "htmlAssetId"> & {
  before: (Shot & { src: string }) | null;
  after: (Shot & { src: string }) | null;
  htmlSrc: string | null;
};

export const REDESIGN_STAGES = [
  "Capturing your current design",
  "Rewriting headlines and calls to action",
  "Building your new styleguide",
  "Applying every change to your page",
  "Rendering before and after",
] as const;

export const REDESIGN_STALE_MS = 6 * 60 * 1000;

export function redesignView(raw: string | null | undefined, token?: string): RedesignView | null {
  if (!raw) return null;
  const r = JSON.parse(raw) as RedesignRecord;
  const q = token ? `?t=${token}` : "";
  const src = (s?: Shot | null) => (s ? { ...s, src: `/api/assets/${s.assetId}${q}` } : null);
  if (r.status === "processing" && Date.now() - new Date(r.startedAt).getTime() > REDESIGN_STALE_MS) {
    r.status = "failed";
    r.error = "The redesign was interrupted. Run it again.";
  }
  const { before, after, htmlAssetId, ...rest } = r;
  return { ...rest, before: src(before), after: src(after), htmlSrc: htmlAssetId ? `/api/assets/${htmlAssetId}${q}` : null };
}

export const colorOf = (plan: RedesignPlan, role: ColorRole, fallback: string) => plan.styleguide.colors.find((c) => c.role === role)?.hex ?? fallback;
export const typeOf = (plan: RedesignPlan, token: TypeToken) => plan.styleguide.type.find((t) => t.token === token);

// ---- Color helpers ----

export function parseColor(input: string): [number, number, number] | null {
  const s = input.trim().toLowerCase();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/);
  if (rgb) {
    if (rgb[4] !== undefined && Number(rgb[4]) < 0.5) return null;
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  return null;
}

export const toHex = ([r, g, b]: [number, number, number]) =>
  "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

function luminance([r, g, b]: [number, number, number]) {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: string, b: string) {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return 1;
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function saturation([r, g, b]: [number, number, number]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

// Darkens a color until it reaches the target contrast against white.
export function ensureContrast(hex: string, target: number, against = "#ffffff") {
  let c = parseColor(hex) ?? [59, 76, 202];
  for (let i = 0; i < 40 && contrast(toHex(c), against) < target; i++) c = [c[0] * 0.92, c[1] * 0.92, c[2] * 0.92];
  return toHex(c);
}

const mix = (a: string, b: string, t: number) => {
  const ca = parseColor(a)!;
  const cb = parseColor(b)!;
  return toHex([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]);
};

// ---- Heuristic plan (used when the Claude engine is not configured) ----

type PlanInput = {
  productName: string;
  primaryGoal: string;
  growthScore: number;
  findings: { id: string; title: string; category: string; severity: string; impact: number; recommendedFix: string }[];
  page: { h1: string[]; headings: string[]; ctas: string[]; aboveFoldCtas: string[]; metaDescription: string; hasDemoOrTrial: boolean } | null;
  current: CurrentStyle | null;
};

const SYSTEM_FONTS = /^(-apple-system|system-ui|blinkmacsystemfont|segoe ui|helvetica|arial|sans-serif|roboto|times|georgia|serif|ui-sans-serif|verdana|tahoma)/i;
const FILLER = /\b(the|a|an|unified|all-in-one|ai-native|ai-powered|next-generation|next-gen|innovative|leading|modern|powerful|seamless|robust|cutting-edge|world-class|best-in-class|operational|data-driven|platform|solution|solutions)\b/gi;
const GENERIC_CTA = /^(get started|start|submit|sign up|signup|learn more|click here|continue|go|try|try it|join|register)$/i;
const DEMO_CTA = /demo|sales|contact|talk/i;
const LOGIN = /log ?in|sign ?in|account/i;

const sentence = (s: string) => {
  const t = s.trim().replace(/[\s,;:]+$/, "");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? "" : ".") : t;
};
const words = (s: string) => s.split(/\s+/).filter(Boolean);
const clip = (s: string, n: number) => words(s).slice(0, n).join(" ");

// Pulls an outcome phrase ("make better decisions, faster") out of the page's own copy.
function outcomeFrom(text: string) {
  const m =
    text.match(/\bso (?:that )?(?:you|your team|every team|teams|everyone) can ([^.]+?)(?:\.|$)/i) ??
    text.match(/\b(?:helps?|lets?|enables?) (?:you|your team|teams|companies|businesses) (?:to )?([^.]+?)(?:\.|$)/i);
  if (!m) return null;
  // Keep the last clause, which usually carries the benefit ("... and make better decisions, faster").
  const parts = m[1].split(/\band\b/);
  let phrase = parts[parts.length - 1].replace(/\bacross\b.*$/i, "").trim();
  if (words(phrase).length < 3) phrase = m[1].replace(/\bacross\b.*$/i, "").trim();
  return words(phrase).length >= 2 && words(phrase).length <= 10 ? phrase : null;
}

function firstClause(text: string, max = 22) {
  const first = text.split(/(?<=[.!?])\s/)[0];
  const listCut = first.replace(/,\s*(with|so|and over|including)\b.*$/i, "");
  return sentence(clip(listCut, max));
}

export function heuristicPlan(input: PlanInput): RedesignPlan {
  const { page, current, findings } = input;
  const find = (re: RegExp) => findings.find((f) => re.test(f.title) || re.test(f.recommendedFix));
  const copy: RedesignPlan["copy"] = [];
  const changes: RedesignPlan["changes"] = [];
  const h1 = page?.h1[0] ?? "";
  const hero = current?.heroParagraph ?? "";
  const headlineFinding = find(/headline|value prop|hero|outcome/i);

  // Headline: outcome first, under ten words.
  if (h1 && (words(h1).length > 8 || headlineFinding)) {
    const outcome = outcomeFrom(hero) ?? outcomeFrom(page?.metaDescription ?? "");
    const stripped = h1.replace(FILLER, " ").replace(/\s+/g, " ").replace(/^[\s,]+|[\s,]+$/g, "");
    const after = outcome ? sentence(outcome) : sentence(clip(stripped, 8));
    if (after && after.toLowerCase() !== h1.toLowerCase()) {
      copy.push({ role: "headline", before: h1, after, why: "Leads with the result the visitor gets, in under ten words, instead of describing the category.", findingId: headlineFinding?.id ?? null });
    }
  }
  // Subheadline: one sentence that says how.
  if (hero && words(hero).length > 28) {
    copy.push({ role: "subheadline", before: hero, after: firstClause(hero), why: "One scannable sentence that explains how, so the headline carries the promise and this line carries the proof.", findingId: find(/dense|wall of text|cognitive|copy|paragraph/i)?.id ?? null });
  }

  // Calls to action: one primary, one quiet secondary, the rest removed from the hero.
  const hero_ctas = (page?.aboveFoldCtas ?? []).filter((c) => !LOGIN.test(c));
  const unique = Array.from(new Set(hero_ctas));
  const primaryBefore = unique.find((c) => !DEMO_CTA.test(c) && !/video|watch/i.test(c)) ?? unique[0] ?? null;
  const secondaryBefore = unique.find((c) => c !== primaryBefore && /demo/i.test(c)) ?? null;
  const remove = unique.filter((c) => c !== primaryBefore && c !== secondaryBefore);
  const ctaFinding = find(/call to action|cta|competing|actions? compete|button/i);
  if (primaryBefore && GENERIC_CTA.test(primaryBefore.trim())) {
    // Only promise a trial when the page already offers one.
    const after = page?.hasDemoOrTrial ? "Start free trial" : "Create your account";
    copy.push({ role: "primary_cta", before: primaryBefore, after, why: "Says exactly what happens next and lowers the perceived commitment.", findingId: ctaFinding?.id ?? null });
  }
  if (secondaryBefore && /^book a demo$/i.test(secondaryBefore)) {
    copy.push({ role: "secondary_cta", before: secondaryBefore, after: "Or book a demo", why: "Framed as the alternative, so it no longer competes with the primary action.", findingId: ctaFinding?.id ?? null });
  }
  if (remove.length) {
    changes.push({ area: "cta", title: `Hero actions cut from ${unique.length} to ${secondaryBefore ? 2 : 1}`, detail: `Removed ${remove.map((r) => `“${r}”`).join(", ")} from the hero so one action leads. The primary button uses the brand color site-wide; the alternative is a text link.`, findingId: ctaFinding?.id ?? null });
  }

  // Generic section headings become benefit statements.
  for (const h of (page?.headings ?? current?.headings ?? []).slice(0, 6)) {
    const m = h.match(/^everything (?:your|you) (.+?) needs?$/i);
    if (m) copy.push({ role: "section_heading", before: h, after: `What changes for your ${m[1]} in the first week`, why: "Turns a feature roundup into a promise the section then proves.", findingId: null });
    else if (/^(built for scale|features|why us|why choose us|our platform)$/i.test(h)) {
      copy.push({ role: "section_heading", before: h, after: h.toLowerCase() === "built for scale" ? "Grows with you from first dashboard to enterprise" : `Why teams choose ${input.productName}`, why: "Specific headings get read; generic ones get skipped.", findingId: null });
    }
  }

  // Styleguide derived from the current brand, with contrast and hierarchy fixed.
  const brandRaw = current?.buttons
    .map((b) => parseColor(b.background))
    .filter((c): c is [number, number, number] => !!c && saturation(c) > 0.35)
    .map(toHex)[0] ?? "#4f46e5";
  const primary = ensureContrast(brandRaw, 4.6);
  const ink = ensureContrast(parseColor(current?.body.color ?? "") ? toHex(parseColor(current!.body.color)!) : "#111827", 14);
  const muted = ensureContrast(mix(ink, "#ffffff", 0.32), 6.5);
  const keepHeading = current?.headingFont && !SYSTEM_FONTS.test(current.headingFont) ? current.headingFont : null;
  const headingFont = keepHeading ?? "Plus Jakarta Sans";
  const bodyFont = current?.bodyFont && !SYSTEM_FONTS.test(current.bodyFont) ? current.bodyFont : "Inter";
  const headlineLen = words(copy.find((c) => c.role === "headline")?.after ?? h1).length;
  const display = headlineLen <= 6 ? 64 : headlineLen <= 9 ? 58 : 50;
  const radius = Math.max(8, Math.min(14, current?.buttons[0]?.radius ?? 10));

  const styleguide: RedesignPlan["styleguide"] = {
    name: `${input.productName} Outcome UI`,
    fonts: { heading: headingFont, body: bodyFont },
    colors: [
      { role: "primary", name: "Brand", hex: primary },
      { role: "on_primary", name: "On brand", hex: "#ffffff" },
      { role: "ink", name: "Ink", hex: ink },
      { role: "muted", name: "Slate", hex: muted },
      { role: "background", name: "Paper", hex: "#ffffff" },
      { role: "surface", name: "Mist", hex: mix(primary, "#ffffff", 0.94) },
      { role: "accent", name: "Highlight", hex: mix(primary, "#ffffff", 0.78) },
      { role: "success", name: "Proof green", hex: "#0f8a5f" },
    ],
    type: [
      { token: "display", size: display, weight: 800, lineHeight: 1.04, tracking: -0.035 },
      { token: "h2", size: 38, weight: 750, lineHeight: 1.12, tracking: -0.025 },
      { token: "h3", size: 22, weight: 700, lineHeight: 1.3, tracking: -0.01 },
      { token: "body_lg", size: 20, weight: 400, lineHeight: 1.55, tracking: 0 },
      { token: "body", size: 17, weight: 400, lineHeight: 1.65, tracking: 0 },
      { token: "small", size: 14, weight: 500, lineHeight: 1.5, tracking: 0.01 },
      { token: "button", size: 17, weight: 700, lineHeight: 1, tracking: 0 },
    ],
    radius,
    spacing: 8,
    voice: [
      "Lead with the outcome the reader gets, then say how.",
      "One idea per sentence, under 20 words.",
      "Buttons say what happens next: verb plus object.",
      "Back every claim with a number, a name or a screenshot.",
    ],
  };

  const cur = current?.h1;
  if (cur) {
    changes.unshift({ area: "typography", title: "Bolder, larger headline", detail: `Headline moves from ${Math.round(cur.size)}px / ${cur.weight} to ${display}px / 800 in ${headingFont}, with tighter tracking, so it is the first thing the eye lands on.`, findingId: headlineFinding?.id ?? null });
  }
  if (copy.some((c) => c.role === "headline")) changes.unshift({ area: "copy", title: "Outcome-led headline", detail: "The headline now states the result for the buyer; category language moves out of the hero.", findingId: headlineFinding?.id ?? null });
  if (copy.some((c) => c.role === "subheadline")) changes.push({ area: "hierarchy", title: "Shorter supporting line", detail: "The hero paragraph is cut to one sentence at 20px with a 60-character line length.", findingId: find(/dense|cognitive|copy/i)?.id ?? null });
  if (contrast(brandRaw, "#ffffff") < 4.5) changes.push({ area: "contrast", title: "Accessible brand color", detail: `The primary color moves from ${brandRaw} to ${primary} so white button text reaches WCAG AA (4.5:1).`, findingId: null });
  changes.push({ area: "spacing", title: "Consistent rhythm", detail: `Spacing follows an ${styleguide.spacing}px grid and buttons and cards share a ${radius}px radius.`, findingId: null });

  const addressed = new Set([...copy, ...changes].map((c) => c.findingId).filter(Boolean) as string[]);
  const lift = findings.filter((f) => addressed.has(f.id)).reduce((n, f) => n + (f.severity === "critical" ? 5 : f.severity === "high" ? 3 : 1.5), 0);
  const projectedScore = Math.min(92, Math.round(input.growthScore + Math.max(6, lift)));

  return {
    summary: `The hero now leads with an outcome and one clear action, set in a bolder type system built from your brand color. ${copy.length} copy changes and ${changes.length} design changes are applied directly to your page.`,
    copy,
    ctas: { primary: primaryBefore, secondary: secondaryBefore, remove },
    styleguide,
    changes,
    projectedScore,
  };
}

// Design tokens as CSS custom properties, for the styleguide download.
export function styleguideCss(plan: RedesignPlan) {
  const sg = plan.styleguide;
  const lines = [
    `/* ${sg.name} — generated by UX Analysis Audit, powered by Matan.Design */`,
    `@import url("https://fonts.googleapis.com/css2?family=${encodeURIComponent(sg.fonts.heading)}:wght@400;600;700;800&family=${encodeURIComponent(sg.fonts.body)}:wght@400;500;600;700&display=swap");`,
    ":root {",
    ...sg.colors.map((c) => `  --color-${c.role.replace(/_/g, "-")}: ${c.hex}; /* ${c.name} */`),
    `  --font-heading: "${sg.fonts.heading}", ui-sans-serif, system-ui, sans-serif;`,
    `  --font-body: "${sg.fonts.body}", ui-sans-serif, system-ui, sans-serif;`,
    ...sg.type.flatMap((t) => [`  --text-${t.token.replace(/_/g, "-")}: ${t.size}px;`, `  --weight-${t.token.replace(/_/g, "-")}: ${t.weight};`, `  --leading-${t.token.replace(/_/g, "-")}: ${t.lineHeight};`]),
    `  --radius: ${sg.radius}px;`,
    `  --space: ${sg.spacing}px;`,
    "}",
  ];
  return lines.join("\n") + "\n";
}
