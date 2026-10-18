import { prisma } from "./prisma";
import { finalizeReport, type Finding, type ReportCore } from "./report";

// The public sample report: a fictional B2B SaaS product ("Acme Insights") rendered from
// scripts/sample-site and captured into public/sample by scripts/capture-sample.mjs.

export const SAMPLE_TOKEN = "sample";
const SAMPLE_EMAIL = "sample@ux-analysis-audit.local";

const SHOTS = [
  { path: "/sample/home.png", label: "Home: above the fold", width: 1440, height: 900 },
  { path: "/sample/home-2.png", label: "Home: features section", width: 1440, height: 900 },
  { path: "/sample/signup.png", label: "Sign up", width: 1440, height: 900 },
  { path: "/sample/app.png", label: "In-app: first screen after sign-in", width: 1440, height: 900 },
  { path: "/sample/mobile.png", label: "Mobile: above the fold", width: 390, height: 844 },
];

const F = (f: Finding) => f;

const findings: Finding[] = [
  F({
    id: "F1", category: "messaging", severity: "critical", impact: 5, effort: "low",
    title: "Headline describes a category, not an outcome",
    problem: "The hero headline “The unified, AI-native operational intelligence platform for modern data-driven revenue organizations” is 13 words of category language. It never says what a revenue leader gets, or how fast.",
    whyItMatters: "Visitors decide in seconds whether a page is relevant. Abstract category terms force them to translate the claim into value themselves, and most leave before they do.",
    businessImpact: "This is the highest-traffic element on the site. A vague headline suppresses visitor-to-signup conversion on every paid and organic visit and weakens recall in competitive evaluations.",
    recommendedFix: "Lead with the outcome and the buyer in under ten words, for example “Forecast revenue you can defend in the board meeting.” Move “AI-native” and integration claims to the subheading. A/B test two outcome-led variants against the current headline.",
    annotation: { screenshotIndex: 0, x: 2.6, y: 15.4, w: 49, h: 25.5 }, annotationNote: "13-word category headline",
  }),
  F({
    id: "F2", category: "core_flow", severity: "critical", impact: 5, effort: "low",
    title: "Four equal-weight actions compete in the hero",
    problem: "“Get started”, “Book a demo”, “Watch video” and “Talk to sales” sit side by side with four different colors. The header adds a fifth “Get started”. No action is clearly primary.",
    whyItMatters: "When every option looks equally important, visitors hesitate or pick the least committal one. Choice overload is the most common cause of hero-section drop-off.",
    businessImpact: "Traffic splits across low-value paths such as the video, reducing the share that reaches trial signup, which is the metric this audit was asked to improve.",
    recommendedFix: "Keep one primary button (“Start free trial”) and one secondary text link (“Book a demo”). Remove “Watch video” from the hero and embed the video lower on the page. Use a single accent color for the primary action site-wide.",
    annotation: { screenshotIndex: 0, x: 2.6, y: 57.4, w: 38.8, h: 7.2 }, annotationNote: "4 competing calls to action",
  }),
  F({
    id: "F3", category: "onboarding", severity: "critical", impact: 5, effort: "medium",
    title: "First session lands on an empty dashboard",
    problem: "After sign-up, new users see four KPI tiles reading 0 and four panels reading “No data available”. There is no checklist, sample data or guidance on connecting the first source.",
    whyItMatters: "Activation depends on reaching a first meaningful result quickly. An empty state with no next step leaves new users to figure out setup on their own, which is where most trials stall.",
    businessImpact: "Directly caps trial-to-paid conversion. For a data product, time-to-first-insight is the strongest predictor of conversion and retention.",
    recommendedFix: "Replace the empty home with a three-step setup checklist (connect a source, pick a template dashboard, invite a teammate) with progress, and load a sample dataset so every panel shows a realistic preview until real data arrives.",
    annotation: { screenshotIndex: 3, x: 18.8, y: 9.6, w: 79.2, h: 65.6 }, annotationNote: "Every module empty, no next step",
  }),
  F({
    id: "F4", category: "onboarding", severity: "high", impact: 4, effort: "low",
    title: "Sign-up form asks for eight fields before any value",
    problem: "The trial form requires first name, last name, work email, phone number, company, job title, company size and password. The submit button is labelled “Submit”.",
    whyItMatters: "Completion rates fall sharply after three or four fields, and phone number is the field most associated with abandonment because it signals a sales call.",
    businessImpact: "Direct loss of trial starts at the highest-intent moment in the funnel.",
    recommendedFix: "Reduce to work email and password, or Google sign-in. Collect role and company size inside the product after the first dashboard loads. Rename the button to “Start 14-day trial”.",
    annotation: { screenshotIndex: 2, x: 31.6, y: 11.6, w: 36.8, h: 86 }, annotationNote: "8 required fields",
  }),
  F({
    id: "F5", category: "strategic_risks", severity: "high", impact: 4, effort: "low",
    title: "No customer proof anywhere on the page",
    problem: "There are no customer logos, testimonials, case studies or usage numbers. The only proof is the unsupported claim “processes billions of events every month”.",
    whyItMatters: "For a buyer evaluating a system that will hold revenue data, evidence from similar companies is the strongest de-risking signal available.",
    businessImpact: "Lengthens sales cycles, lowers demo-to-close rates, and reads as weak traction to investors reviewing the product.",
    recommendedFix: "Add a logo strip directly below the hero and one quantified customer outcome (metric, name, role, company) next to the primary call to action. Turn the “Built for scale” band into a proof section with real numbers.",
    annotation: { screenshotIndex: 1, x: 0, y: 76.5, w: 100, h: 23.3 }, annotationNote: "Claim with no evidence",
  }),
  F({
    id: "F6", category: "heuristics", severity: "medium", impact: 3, effort: "low",
    title: "Hero copy is too dense to scan",
    problem: "The subheading is a 60-word single sentence listing six capabilities and an integration count.",
    whyItMatters: "Dense hero copy raises cognitive load and dilutes the one message that should land. Executives and mobile visitors skim, they do not read.",
    businessImpact: "Lower message recall and lower engagement with the primary action.",
    recommendedFix: "Cut the subheading to one sentence of under 20 words that supports the headline outcome. Move the capability list into the features section.",
    annotation: { screenshotIndex: 0, x: 2.6, y: 40.6, w: 48.6, h: 15.6 }, annotationNote: "60-word subheading",
  }),
  F({
    id: "F7", category: "heuristics", severity: "medium", impact: 3, effort: "low",
    title: "Navigation exposes nine top-level choices and no pricing",
    problem: "The header lists Platform, Solutions, Integrations, Customers, Resources, Partners, Company, Careers and Blog. Pricing is not linked.",
    whyItMatters: "Long navigation pulls attention from the conversion path, and hiding pricing pushes self-qualifying buyers to leave and compare elsewhere.",
    businessImpact: "More drift into low-intent pages, fewer self-serve trials, and more unqualified demo requests.",
    recommendedFix: "Reduce to Product, Customers, Pricing and Resources. Move Partners, Company, Careers and Blog into the footer. Show at least the starting price or plan structure.",
    annotation: { screenshotIndex: 0, x: 22.9, y: 2.2, w: 51.2, h: 4.4 }, annotationNote: "9 links, no Pricing",
  }),
  F({
    id: "F8", category: "core_flow", severity: "high", impact: 4, effort: "low",
    title: "Primary action falls below the fold on mobile",
    problem: "On a 390px screen the four-line headline fills the first view. Visitors must scroll past the full subheading before reaching any button.",
    whyItMatters: "A large share of first visits from social, email and ads happen on mobile, and intent drops with every scroll required.",
    businessImpact: "Lower mobile conversion drags down blended acquisition efficiency.",
    recommendedFix: "Shorten the mobile headline, hide the long subheading below 640px, and add a sticky bottom bar with the single primary action.",
    annotation: { screenshotIndex: 4, x: 8, y: 18, w: 84, h: 78 }, annotationNote: "No action in first view",
  }),
  F({
    id: "F9", category: "dashboard", severity: "high", impact: 4, effort: "medium",
    title: "Thirteen navigation items before the first insight",
    problem: "The app sidebar lists 13 destinations, including Datasets, Models, Workflows and Admin, all at the same level as Home.",
    whyItMatters: "New users cannot tell which areas matter now and which are for later. Equal weighting increases the time to find the core workflow.",
    businessImpact: "Slower activation and lower adoption of the features that drive retention.",
    recommendedFix: "Group navigation into Analyze (Dashboards, Explore, Alerts), Build (Metrics, Datasets, Models) and Admin. Collapse the Build and Admin groups for new accounts.",
    annotation: { screenshotIndex: 3, x: 0, y: 0, w: 16.9, h: 100 }, annotationNote: "13 equal-weight items",
  }),
  F({
    id: "F10", category: "dashboard", severity: "medium", impact: 3, effort: "low",
    title: "Toolbar offers four actions with no clear primary",
    problem: "Import, Export, Share and New sit together on the home screen. On an empty account, Export and Share do nothing useful.",
    whyItMatters: "Irrelevant actions add noise and imply the product is complex before the user has done anything.",
    businessImpact: "Adds friction to the first session and reduces perceived ease of use.",
    recommendedFix: "On empty accounts show only “Connect a data source”. Reveal Export and Share once a dashboard exists.",
    annotation: { screenshotIndex: 3, x: 72.8, y: 2.6, w: 25, h: 5.6 }, annotationNote: "Irrelevant actions when empty",
  }),
  F({
    id: "F11", category: "messaging", severity: "medium", impact: 3, effort: "low",
    title: "Feature section lists capabilities, not results",
    problem: "Cards such as “Unified data layer” and “Permissions” describe what the product has. None states what a revenue leader achieves with it.",
    whyItMatters: "Buyers compare outcomes. Feature lists look interchangeable with every competitor in the category.",
    businessImpact: "Weaker differentiation and more price pressure in competitive deals.",
    recommendedFix: "Rewrite each card as a result with a number where possible, for example “Catch pipeline risk two weeks earlier” instead of “Anomaly detection”.",
    annotation: { screenshotIndex: 1, x: 2.6, y: 24, w: 94.8, h: 52 }, annotationNote: "Features without outcomes",
  }),
  F({
    id: "F12", category: "strategic_risks", severity: "medium", impact: 3, effort: "low",
    title: "Security posture is invisible for a data platform",
    problem: "A product that connects CRM, billing and warehouse data shows no mention of security, compliance or data handling.",
    whyItMatters: "Security review is a mandatory step for this category of purchase. Missing information delays deals at procurement.",
    businessImpact: "Longer enterprise sales cycles and avoidable losses at the security review stage.",
    recommendedFix: "Add a security band with compliance status, encryption and data residency, linking to a dedicated trust page.",
    annotation: { screenshotIndex: 1, x: 0, y: 76.5, w: 100, h: 23.3 }, annotationNote: "No trust or compliance signals",
  }),
];

const core: ReportCore = {
  executiveSummary:
    "Acme Insights has a capable product hidden behind category language and an unguided first session. Three blockers account for most of the lost growth: a headline that does not state an outcome, a hero with four competing actions, and an empty first-run dashboard. All three can be addressed within two sprints, and the first two within days.",
  subScores: [
    { key: "value_proposition", score: 41, rationale: "The headline names a category rather than an outcome, and the subheading lists capabilities." },
    { key: "onboarding", score: 38, rationale: "Eight-field sign-up followed by an empty dashboard with no guided first step." },
    { key: "conversion", score: 52, rationale: "Five calls to action across header and hero; primary action below the fold on mobile." },
    { key: "cognitive_load", score: 55, rationale: "Nine marketing navigation items and thirteen in-app destinations at equal weight." },
    { key: "hierarchy", score: 63, rationale: "Clean layout, but dense hero copy and equal-weight modules dilute priority." },
    { key: "trust", score: 44, rationale: "No logos, testimonials, quantified outcomes or security information." },
  ],
  criticalIssues: [
    { findingId: "F1", title: findings[0].title, impactLevel: "critical", businessImpact: findings[0].businessImpact, fix: findings[0].recommendedFix },
    { findingId: "F3", title: findings[2].title, impactLevel: "critical", businessImpact: findings[2].businessImpact, fix: findings[2].recommendedFix },
    { findingId: "F2", title: findings[1].title, impactLevel: "critical", businessImpact: findings[1].businessImpact, fix: findings[1].recommendedFix },
  ],
  findings,
  screenshotLabels: SHOTS.map((s) => s.label),
};

export async function ensureSample() {
  const existing = await prisma.audit.findUnique({ where: { shareToken: SAMPLE_TOKEN } });
  if (existing) return existing;
  const user = await prisma.user.upsert({
    where: { email: SAMPLE_EMAIL },
    update: {},
    create: { email: SAMPLE_EMAIL, name: "Sample", plan: "pro", provider: "system" },
  });
  const audit = await prisma.audit.create({
    data: {
      userId: user.id,
      productName: "Acme Insights",
      productUrl: "https://acme-insights.example",
      productType: "saas_app",
      growthStage: "series_a",
      primaryGoal: "activation",
      accessMethod: "demo",
      focusAreas: JSON.stringify(["onboarding", "dashboard", "messaging", "core_workflow"]),
      status: "processing",
    },
  });
  const assets = [];
  for (const [i, s] of SHOTS.entries()) {
    assets.push(
      await prisma.asset.create({
        data: { auditId: audit.id, kind: "screenshot", label: s.label, source: "capture", path: s.path, mimeType: "image/png", width: s.width, height: s.height, order: i },
      }),
    );
  }
  const report = finalizeReport(core, assets.map((a) => ({ assetId: a.id, label: a.label, width: a.width!, height: a.height! })), "claude");
  return prisma.audit.update({
    where: { id: audit.id },
    data: { status: "complete", stage: 5, report: JSON.stringify(report), growthScore: report.growthScore, engine: "sample", completedAt: new Date(), shareToken: SAMPLE_TOKEN, secretsPurgedAt: new Date() },
  });
}
