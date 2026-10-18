// Figures shown on the landing page. Every product figure comes from the Acme Insights
// sample audit (lib/sample.ts). Benchmark figures are illustrative placeholders: replace
// them with your own aggregate data before using them in marketing.

export const SAMPLE_KPIS = {
  score: 48,
  screens: 5,
  findings: { critical: 3, high: 4, medium: 5 },
  quickWins: 10, // findings rated low effort
};

export const SUB_SCORE_SPARK = [41, 38, 52, 55, 63, 44];

export const BENCHMARK_LABEL = "Top-quartile SaaS (illustrative)";

export const BENCHMARKS = [
  { label: "Value proposition", product: 41, benchmark: 82 },
  { label: "Onboarding", product: 38, benchmark: 76 },
  { label: "Conversion path", product: 52, benchmark: 79 },
  { label: "Cognitive load", product: 55, benchmark: 72 },
  { label: "Hierarchy", product: 63, benchmark: 80 },
  { label: "Trust signals", product: 44, benchmark: 81 },
];

export const SCORE_MARKERS = [
  { label: "Acme", value: 48, tone: "product" as const },
  { label: "Median", value: 64, tone: "ref" as const },
  { label: "Top 25%", value: 81, tone: "ref" as const },
];

// Stats from the sample report, each pinned to the screenshot region it was measured on.
export const EVIDENCE = [
  {
    value: 13, suffix: " words", title: "in the headline, none of them an outcome", severity: "critical",
    shot: "/sample/home.png", w: 1440, h: 900, box: { screenshotIndex: 0, x: 2.6, y: 15.4, w: 49, h: 25.5 }, where: "Home · above the fold",
  },
  {
    value: 4, suffix: " CTAs", title: "competing for attention in the hero", severity: "critical",
    shot: "/sample/home.png", w: 1440, h: 900, box: { screenshotIndex: 0, x: 2.6, y: 57.4, w: 38.8, h: 7.2 }, where: "Home · above the fold",
  },
  {
    value: 0, suffix: " next steps", title: "on the first in-app screen after sign-up", severity: "critical",
    shot: "/sample/app.png", w: 1440, h: 900, box: { screenshotIndex: 0, x: 18.8, y: 9.6, w: 79.2, h: 65.6 }, where: "Dashboard · first session",
  },
  {
    value: 8, suffix: " fields", title: "required before the user sees any value", severity: "high",
    shot: "/sample/signup.png", w: 1440, h: 900, box: { screenshotIndex: 0, x: 31.6, y: 11.6, w: 36.8, h: 86 }, where: "Sign up",
  },
  {
    value: 13, suffix: " nav items", title: "at equal weight inside the product", severity: "high",
    shot: "/sample/app.png", w: 1440, h: 900, box: { screenshotIndex: 0, x: 0, y: 0, w: 16.9, h: 100 }, where: "Dashboard · sidebar",
  },
  {
    value: 0, suffix: " proof points", title: "no logos, testimonials or numbers", severity: "high",
    shot: "/sample/home-2.png", w: 1440, h: 900, box: { screenshotIndex: 0, x: 0, y: 76.5, w: 100, h: 23.3 }, where: "Home · features",
  },
] as const;

export const SURFACES = [
  {
    title: "Websites & landing pages",
    body: "Paste a URL. We capture desktop and mobile, plus key pages like pricing and sign-up.",
    method: "url",
    cta: "Scan a URL",
    shot: "/sample/home.png", w: 1440, h: 900, box: { screenshotIndex: 0, x: 2.6, y: 15.4, w: 49, h: 25.5 },
  },
  {
    title: "SaaS apps & dashboards",
    body: "Share a demo login. We sign in, walk the signed-in screens and audit onboarding and core workflows. Credentials are deleted right after.",
    method: "demo",
    cta: "Audit with a demo login",
    shot: "/sample/app.png", w: 1440, h: 900, box: { screenshotIndex: 0, x: 18.8, y: 9.6, w: 79.2, h: 65.6 },
  },
  {
    title: "Figma files & designs",
    body: "Connect a Figma file or upload screenshots and recordings to audit work before it ships.",
    method: "figma",
    cta: "Audit a Figma file",
    shot: "/sample/signup.png", w: 1440, h: 900, box: { screenshotIndex: 0, x: 31.6, y: 11.6, w: 36.8, h: 86 },
  },
] as const;
