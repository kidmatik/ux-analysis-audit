import type { Box, Finding, ReportCore, SubScoreKey } from "../report";
import { labelFor, PRIMARY_GOALS, PRODUCT_TYPES } from "../config";
import type { DetectedElement, PageSignals, Screen } from "./types";

// Deterministic rule-based analysis. Runs when no ANTHROPIC_API_KEY is configured (or the
// model call fails), so the full flow works offline. It reads DOM signals and element boxes
// captured by Playwright or Figma, and anchors each finding to the element it is about.

export type AuditContext = {
  productName: string;
  productUrl: string;
  productType: string;
  growthStage: string;
  primaryGoal: string;
  focusAreas: string[];
  accessMethod: string;
};

type Rule = {
  finding: Omit<Finding, "id" | "annotation"> & { annotation: Box | null };
  penalties: Partial<Record<SubScoreKey, number>>;
};

const union = (els: DetectedElement[]) => {
  const x = Math.min(...els.map((e) => e.x));
  const y = Math.min(...els.map((e) => e.y));
  const r = Math.max(...els.map((e) => e.x + e.w));
  const b = Math.max(...els.map((e) => e.y + e.h));
  return { x, y, w: r - x, h: b - y };
};

const pad = (b: { x: number; y: number; w: number; h: number }, p = 1.2) => ({
  x: Math.max(0, b.x - p),
  y: Math.max(0, b.y - p * 1.5),
  w: Math.min(100, b.w + p * 2),
  h: Math.min(100, b.h + p * 3),
});

function locate(screens: Screen[], kind: DetectedElement["kind"], pick: "first" | "all" = "first", screenFilter?: (s: Screen) => boolean): Box | null {
  for (const [i, s] of screens.entries()) {
    if (screenFilter && !screenFilter(s)) continue;
    const els = s.elements.filter((e) => e.kind === kind);
    if (!els.length) continue;
    const b = pick === "all" ? union(els) : els[0];
    return { screenshotIndex: i, ...pad(b) };
  }
  return null;
}

function region(screens: Screen[], index: number, x: number, y: number, w: number, h: number): Box | null {
  if (!screens.length) return null;
  return { screenshotIndex: Math.min(index, screens.length - 1), x, y, w, h };
}

// Body copy between the headline and the first hero action, i.e. the hero text block only.
function heroCopyBox(screens: Screen[]): Box | null {
  const s = screens[0];
  if (!s) return null;
  const h1 = s.elements.find((e) => e.kind === "headline");
  const cta = s.elements.filter((e) => e.kind === "cta" && e.y > 9).sort((a, b) => a.y - b.y)[0];
  const top = h1 ? h1.y : 8;
  const bottom = cta ? cta.y : 75;
  const texts = s.elements.filter((e) => (e.kind === "text" || e.kind === "headline") && e.y >= top - 1 && e.y + e.h <= bottom + 1);
  return texts.length ? { screenshotIndex: 0, ...pad(union(texts)) } : null;
}

const countLabel = (n: number, noun: string) => `${n === 0 ? "no" : n} ${noun}${n === 1 ? "" : "s"}`;
const quote = (s: string, n = 90) => `“${s.length > n ? s.slice(0, n - 1) + "…" : s}”`;
const isInApp = (s: Screen) => /in-app|figma|upload|recording/i.test(s.label);
const isMobile = (s: Screen) => /mobile/i.test(s.label);

export function heuristicReport(ctx: AuditContext, screens: Screen[], signals: PageSignals[]): ReportCore {
  const home = signals[0];
  const rules: Rule[] = [];
  const product = ctx.productName;
  const typeLabel = labelFor(PRODUCT_TYPES, ctx.productType).toLowerCase();
  const goalLabel = labelFor(PRIMARY_GOALS, ctx.primaryGoal).toLowerCase();
  const isApp = ["saas_app", "dashboard", "platform", "devtool", "marketplace"].includes(ctx.productType);
  const add = (r: Rule) => rules.push(r);

  if (home) {
    const h1 = home.h1[0] ?? "";
    const h1Words = h1.split(/\s+/).filter(Boolean).length;
    const outcome = /(grow|save|increase|reduce|faster|without|in minutes|automate|ship|close|win|cut|boost|scale|more|less|\d)/i.test(h1);
    if (!h1) {
      add({
        finding: {
          category: "messaging", severity: "critical", title: "No primary headline anchors the page",
          problem: "The first screen has no H1. Visitors have no single statement telling them what the product is and what it changes for them.",
          whyItMatters: "Visitors decide whether to stay within the first few seconds. Without a clear headline that decision is made on visuals alone.",
          businessImpact: "Higher bounce on paid and organic traffic, and weaker organic ranking for the core category term.",
          recommendedFix: "Add one H1 above the fold that states the outcome for a specific buyer, for example “[Outcome] for [audience] without [main pain]”.",
          impact: 5, effort: "low", annotation: region(screens, 0, 4, 10, 60, 40), annotationNote: "No headline in the hero area",
        },
        penalties: { value_proposition: 28, hierarchy: 8 },
      });
    } else if (h1Words > 11 || !outcome) {
      add({
        finding: {
          category: "messaging", severity: h1Words > 14 ? "critical" : "high",
          title: "Headline describes the product, not the outcome",
          problem: `The hero headline ${quote(h1)} ${h1Words > 11 ? `runs ${h1Words} words and` : ""} does not state a measurable outcome for a specific buyer.`,
          whyItMatters: "Buyers scan for relevance to their problem. A feature-led or abstract headline forces them to translate it into value themselves, and most will not.",
          businessImpact: `Works directly against the goal to ${goalLabel}. The headline is typically the single highest-leverage element on the page.`,
          recommendedFix: "Rewrite the headline to name the result and the audience in under 10 words. Move feature detail into the subheading and test two variants against current conversion.",
          impact: 5, effort: "low", annotation: locate(screens, "headline"), annotationNote: "Outcome is not explicit in the headline",
        },
        penalties: { value_proposition: h1Words > 14 ? 26 : 18, conversion: 6 },
      });
    }

    const fold = home.aboveFoldCtas.filter(Boolean);
    if (fold.length === 0) {
      add({
        finding: {
          category: "core_flow", severity: "critical", title: "No call to action above the fold",
          problem: "The first screen contains no visible primary action. Visitors must scroll or search the navigation to take the next step.",
          whyItMatters: "Intent is highest on arrival. Every scroll required before the first action loses part of that intent.",
          businessImpact: "Lower click-through into signup or demo; paid acquisition efficiency drops for every visit.",
          recommendedFix: "Place one high-contrast primary button in the hero, labelled with the specific next step (for example “Start free trial” or “Book a 20-minute demo”).",
          impact: 5, effort: "low", annotation: region(screens, 0, 4, 12, 60, 50), annotationNote: "No primary action in the first view",
        },
        penalties: { conversion: 28 },
      });
    } else if (fold.length > 2) {
      // Union of hero actions only; header buttons would stretch the box across the whole page.
      const heroCtas = screens[0]?.elements.filter((e) => e.kind === "cta" && e.y > 9) ?? [];
      const ctaBox = heroCtas.length ? { screenshotIndex: 0, ...pad(union(heroCtas)) } : locate(screens, "cta");
      add({
        finding: {
          category: "heuristics", severity: "high", title: "Competing calls to action dilute the primary path",
          problem: `${fold.length} different actions compete in the first view (${fold.slice(0, 4).map((c) => quote(c, 24)).join(", ")}). None is clearly dominant.`,
          whyItMatters: "Choice overload delays decisions. When every action looks equally important, the most valuable one is chosen less often.",
          businessImpact: "Traffic is split across low-value paths, reducing the share that reaches signup or demo.",
          recommendedFix: "Keep one primary button and at most one secondary text link in the hero. Demote the rest to the navigation or lower sections.",
          impact: 4, effort: "low", annotation: ctaBox, annotationNote: `${fold.length} competing actions`,
        },
        penalties: { conversion: 12, cognitive_load: 12 },
      });
    }

    const primary = fold[0] ?? home.ctas[0];
    if (primary && /^(learn more|submit|click here|get started|start|go|continue|read more)$/i.test(primary.trim())) {
      add({
        finding: {
          category: "messaging", severity: "medium", title: "Primary button label is generic",
          problem: `The main button reads ${quote(primary)}, which says nothing about what happens next or what the visitor gets.`,
          whyItMatters: "Specific action labels reduce uncertainty about commitment, which is the main hesitation at this step.",
          businessImpact: "Modest but compounding lift in click-through; low-cost to test.",
          recommendedFix: "Rename the button to describe the outcome and commitment level, for example “Start free, no card required” or “See it with your data”.",
          impact: 3, effort: "low", annotation: locate(screens, "cta"), annotationNote: "Generic label",
        },
        penalties: { conversion: 6 },
      });
    }

    if (home.navItems.length > 7) {
      add({
        finding: {
          category: "heuristics", severity: "medium", title: "Navigation carries too many top-level choices",
          problem: `The header exposes ${home.navItems.length} links. Primary paths compete with secondary pages such as ${home.navItems.slice(-3).map((t) => quote(t, 20)).join(", ")}.`,
          whyItMatters: "Every additional top-level item increases scanning time and pulls attention away from the conversion path.",
          businessImpact: "Visitors drift into low-intent pages; fewer reach pricing or signup.",
          recommendedFix: "Reduce top-level navigation to five items or fewer. Group the rest under one menu and keep the primary CTA visually separate on the right.",
          impact: 3, effort: "low", annotation: locate(screens, "nav"), annotationNote: `${home.navItems.length} navigation items`,
        },
        penalties: { cognitive_load: 10, hierarchy: 6 },
      });
    }

    if (home.aboveFoldWords > 90) {
      add({
        finding: {
          category: "heuristics", severity: "medium", title: "First view is text-heavy",
          problem: `Roughly ${home.aboveFoldWords} words compete for attention above the fold. The key message is diluted by supporting copy.`,
          whyItMatters: "Dense first screens raise cognitive load and slow comprehension, especially on mobile and for skimming executives.",
          businessImpact: "Lower message recall and lower engagement with the primary action.",
          recommendedFix: "Limit the hero to a headline, a one-sentence subheading and one action. Move proof and detail into the next section.",
          impact: 3, effort: "low", annotation: heroCopyBox(screens) ?? region(screens, 0, 4, 20, 60, 50), annotationNote: `${home.aboveFoldWords} words above the fold`,
        },
        penalties: { hierarchy: 12, cognitive_load: 8 },
      });
    }

    const proof = home.hasTestimonials || home.hasLogoWall || home.hasNumbersProof;
    if (!proof) {
      add({
        finding: {
          category: "strategic_risks", severity: "high", title: "No social proof supports the claim",
          problem: "The page shows no customer logos, testimonials or usage numbers. Claims are made without evidence.",
          whyItMatters: "For a buyer evaluating an unfamiliar vendor, proof from similar companies is the strongest de-risking signal available.",
          businessImpact: "Lower trust slows sales cycles and reduces conversion on high-intent traffic; investors read it as weak traction.",
          recommendedFix: "Add a logo strip directly under the hero and one quantified customer outcome (metric, name, role, company) near the primary CTA.",
          impact: 4, effort: "low", annotation: region(screens, Math.min(1, screens.length - 1), 4, 4, 92, 40), annotationNote: "No logos, testimonials or numbers",
        },
        penalties: { trust: 26 },
      });
    }

    if (isApp && !home.hasSecuritySignals) {
      add({
        finding: {
          category: "strategic_risks", severity: "medium", title: "Security and compliance posture is invisible",
          problem: "There is no visible mention of security, data handling or compliance (for example SOC 2 or GDPR).",
          whyItMatters: "B2B buyers and procurement look for this before trialling a tool that touches company data.",
          businessImpact: "Longer enterprise sales cycles and drop-off at the security review stage.",
          recommendedFix: "Add a short security band (encryption, compliance status, data residency) and link to a dedicated trust page.",
          impact: 3, effort: "low", annotation: region(screens, screens.length > 2 ? 2 : 0, 4, 50, 92, 40), annotationNote: "No trust or security signals",
        },
        penalties: { trust: 12 },
      });
    }

    if (!home.hasPricingLink) {
      add({
        finding: {
          category: "strategic_risks", severity: ctx.primaryGoal === "monetization" ? "high" : "medium", title: "Pricing is hidden from the primary journey",
          problem: "No pricing or plans link is visible in the navigation or the hero.",
          whyItMatters: "Self-serve buyers use pricing to qualify themselves. Hiding it pushes them to leave and compare elsewhere.",
          businessImpact: "Lower self-serve conversion and more unqualified demo requests.",
          recommendedFix: "Add a Pricing link to the top navigation. If pricing is sales-led, show starting price or plan structure with a clear contact path.",
          impact: 3, effort: "low", annotation: locate(screens, "nav"), annotationNote: "No pricing link",
        },
        penalties: { conversion: 8, trust: 6 },
      });
    }

    if (!home.hasDemoOrTrial) {
      add({
        finding: {
          category: "onboarding", severity: "high", title: "No low-commitment way to experience the product",
          problem: "There is no free trial, interactive demo or sandbox offer. The only paths require a high-commitment step.",
          whyItMatters: "Buyers want to see value before talking to sales. Low-commitment entry points capture interest that would otherwise leave.",
          businessImpact: "Caps top-of-funnel conversion and slows every downstream growth metric.",
          recommendedFix: "Offer one low-commitment entry point: a free plan, a no-card trial, or an interactive product tour linked from the hero.",
          impact: 4, effort: "medium", annotation: locate(screens, "cta"), annotationNote: "No trial or demo offer",
        },
        penalties: { onboarding: 18, conversion: 8 },
      });
    }

    if (home.formFields > 5) {
      add({
        finding: {
          category: "onboarding", severity: "high", title: "Signup asks for too much, too early",
          problem: `The form presents ${home.formFields} fields before the visitor has seen any value.`,
          whyItMatters: "Each additional field adds friction; completion rates fall sharply after three or four fields.",
          businessImpact: "Direct loss of signups at the highest-intent moment.",
          recommendedFix: "Reduce to email (or SSO) and password. Collect role, company size and use case progressively inside the product.",
          impact: 4, effort: "low", annotation: locate(screens, "form"), annotationNote: `${home.formFields} fields`,
        },
        penalties: { onboarding: 16, conversion: 8 },
      });
    }

    if (home.loadMs > 4000) {
      add({
        finding: {
          category: "heuristics", severity: "medium", title: "Slow first load",
          problem: `The page took about ${(home.loadMs / 1000).toFixed(1)} seconds to become interactive during capture.`,
          whyItMatters: "Every additional second of load time measurably increases abandonment, especially on mobile and paid traffic.",
          businessImpact: "Higher bounce and higher effective cost per acquisition.",
          recommendedFix: "Compress hero media, defer third-party scripts and serve static marketing pages from the edge.",
          impact: 3, effort: "medium", annotation: region(screens, 0, 0, 0, 100, 100), annotationNote: "Slow to load",
        },
        penalties: { conversion: 6 },
      });
    }

    if (!home.metaDescription) {
      add({
        finding: {
          category: "messaging", severity: "low", title: "Search and share previews are undefined",
          problem: "There is no meta description, so search results and link previews show arbitrary page text.",
          whyItMatters: "This is often the first impression in search and in shared links.",
          businessImpact: "Lower click-through from search and social.",
          recommendedFix: "Write a 150-character description that restates the headline outcome and audience.",
          impact: 2, effort: "low", annotation: null, annotationNote: "",
        },
        penalties: { value_proposition: 3 },
      });
    }
  }

  const mobileIdx = screens.findIndex(isMobile);
  if (mobileIdx >= 0 && !screens[mobileIdx].elements.some((e) => e.kind === "cta")) {
    add({
      finding: {
        category: "core_flow", severity: "high", title: "Primary action disappears on mobile",
        problem: "On a 390px-wide screen no primary action is visible in the first view.",
        whyItMatters: "A large share of first visits, especially from social and email, happen on mobile.",
        businessImpact: "Mobile visitors cannot convert without extra effort, lowering blended conversion.",
        recommendedFix: "Keep the primary CTA in the mobile hero and consider a sticky bottom action bar.",
        impact: 4, effort: "low", annotation: { screenshotIndex: mobileIdx, x: 4, y: 8, w: 92, h: 60 }, annotationNote: "No visible action on mobile",
      },
      penalties: { conversion: 10 },
    });
  }

  // In-app screens (demo login, Figma, uploads, recordings).
  const appIdx = screens.findIndex(isInApp);
  if (appIdx >= 0 || !home) {
    const idx = appIdx >= 0 ? appIdx : 0;
    const s = screens[idx];
    const nav = s?.elements.filter((e) => e.kind === "nav" || (e.kind === "text" && e.x < 18)) ?? [];
    const texts = s?.elements.filter((e) => e.kind === "text" || e.kind === "subheadline") ?? [];
    const ctas = s?.elements.filter((e) => e.kind === "cta") ?? [];
    if (ctx.focusAreas.includes("onboarding") || ctx.focusAreas.length === 0 || isApp) {
      add({
        finding: {
          category: "onboarding", severity: "critical", title: "First session lacks a guided path to value",
          problem: `The first in-product view does not direct a new user to one clear first action${ctas.length ? `; ${ctas.length} actions compete for attention` : ""}. Users must work out where to start.`,
          whyItMatters: "Activation depends on reaching the first meaningful outcome quickly. Unguided first sessions are where most trial users churn.",
          businessImpact: "Lower activation rate, which caps trial-to-paid conversion and retention.",
          recommendedFix: "Add a short setup checklist (3 to 4 steps) with a progress indicator, pre-filled sample data, and one highlighted next action on the empty state.",
          impact: 5, effort: "medium", annotation: s ? { screenshotIndex: idx, x: 20, y: 12, w: 76, h: 50 } : null, annotationNote: "No clear first action for new users",
        },
        penalties: { onboarding: 24, conversion: 6 },
      });
    }
    if (ctx.focusAreas.includes("dashboard") || ctx.productType === "dashboard") {
      add({
        finding: {
          category: "dashboard", severity: "high", title: "Dashboard leads with data, not decisions",
          problem: `The main view presents ${texts.length > 8 ? "many" : "several"} metrics and modules with similar visual weight. The one number that matters most is not emphasized.`,
          whyItMatters: "Users open dashboards to answer one question. Equal weighting forces them to scan everything to find it.",
          businessImpact: "Lower perceived value per session, reducing habit formation and retention.",
          recommendedFix: "Promote one primary KPI with trend and context to the top-left, group secondary metrics, and add one recommended action tied to that KPI.",
          impact: 4, effort: "medium", annotation: s ? { screenshotIndex: idx, x: 20, y: 18, w: 76, h: 44 } : null, annotationNote: "Equal visual weight across modules",
        },
        penalties: { hierarchy: 16, cognitive_load: 10 },
      });
    }
    if (ctx.focusAreas.includes("discoverability") || nav.length > 9) {
      add({
        finding: {
          category: "core_flow", severity: "medium", title: "Key capabilities are buried in navigation",
          problem: "Important features sit behind generic navigation labels with no contextual entry points from the main workflow.",
          whyItMatters: "Features users never find deliver no value, and undiscovered value is a leading cause of churn.",
          businessImpact: "Lower feature adoption and weaker expansion revenue.",
          recommendedFix: "Rename navigation items by job to be done, and surface contextual prompts for advanced features at the moment they are useful.",
          impact: 3, effort: "medium", annotation: s ? { screenshotIndex: idx, x: 0, y: 6, w: 18, h: 80 } : null, annotationNote: "Generic navigation labels",
        },
        penalties: { cognitive_load: 8, onboarding: 6 },
      });
    }
    if (ctx.focusAreas.includes("ux_consistency")) {
      add({
        finding: {
          category: "heuristics", severity: "medium", title: "Inconsistent component patterns across screens",
          problem: "Buttons, spacing and type scale vary between screens, so the same action looks different in different places.",
          whyItMatters: "Inconsistency forces users to relearn the interface and erodes perceived quality.",
          businessImpact: "Lower trust in product quality, which matters in sales demos and investor diligence.",
          recommendedFix: "Consolidate into a small set of button, input and card variants and apply one spacing and type scale.",
          impact: 3, effort: "high", annotation: s && screens.length > 1 ? { screenshotIndex: Math.min(idx + 1, screens.length - 1), x: 20, y: 20, w: 60, h: 40 } : null, annotationNote: "Pattern differs from previous screen",
        },
        penalties: { hierarchy: 8, trust: 4 },
      });
    }
  }

  if (ctx.focusAreas.includes("monetization")) {
    add({
      finding: {
        category: "strategic_risks", severity: "high", title: "Upgrade moments are not tied to value",
        problem: "There is no visible path from experiencing value to upgrading. Plan limits and paid features are not surfaced in context.",
        whyItMatters: "Users upgrade when they hit a limit while getting value, not from a pricing page they never revisit.",
        businessImpact: "Lower trial-to-paid conversion and expansion revenue.",
        recommendedFix: "Add contextual upgrade prompts at usage limits and next to premium features, with a one-click path to checkout.",
        impact: 4, effort: "medium", annotation: screens.length ? { screenshotIndex: Math.max(0, appIdx >= 0 ? appIdx : 0), x: 60, y: 2, w: 38, h: 14 } : null, annotationNote: "No upgrade path in context",
      },
      penalties: { conversion: 10 },
    });
  }

  if (ctx.growthStage === "pre_fundraise" || ctx.primaryGoal === "fundraise") {
    add({
      finding: {
        category: "strategic_risks", severity: "medium", title: "Product story does not match the investment narrative",
        problem: "The product does not visibly evidence the traction and differentiation an investor will look for in a demo.",
        whyItMatters: "Investors use the product as proof of the deck. Gaps between the two raise diligence questions.",
        businessImpact: "Weaker fundraising position and longer diligence.",
        recommendedFix: "Align the headline with the deck’s positioning, surface customer proof, and prepare a demo path that reaches the core outcome in under two minutes.",
        impact: 3, effort: "medium", annotation: null, annotationNote: "",
      },
      penalties: { value_proposition: 6, trust: 4 },
    });
  }

  if (rules.length < 4) {
    add({
      finding: {
        category: "messaging", severity: "medium", title: "Differentiation is not explicit",
        problem: `The ${typeLabel} explains what ${product} does but not why it is better than the obvious alternative.`,
        whyItMatters: "Buyers compare. Without an explicit point of difference they default to the familiar option or to price.",
        businessImpact: "Lower win rate against competitors and more price pressure.",
        recommendedFix: "State one sharp point of difference near the headline and support it with a comparison section lower on the page.",
        impact: 3, effort: "low", annotation: screens.length ? region(screens, 0, 4, 18, 60, 30) : null, annotationNote: "No explicit differentiator",
      },
      penalties: { value_proposition: 10 },
    });
  }

  const findings: Finding[] = rules.map((r, i) => ({ ...r.finding, id: `F${i + 1}` }));
  const scores: Record<SubScoreKey, number> = { value_proposition: 86, onboarding: 84, conversion: 85, cognitive_load: 84, hierarchy: 85, trust: 86 };
  for (const r of rules) for (const [k, v] of Object.entries(r.penalties)) scores[k as SubScoreKey] -= v!;
  if (!home && !screens.length) for (const k of Object.keys(scores)) scores[k as SubScoreKey] -= 10;

  const rationale: Record<SubScoreKey, string> = {
    value_proposition: "How quickly a target buyer understands what the product does and the outcome it delivers.",
    onboarding: "How directly a new user reaches first value, and how much effort is required before it.",
    conversion: "Clarity and prominence of the primary path to signup, demo or purchase.",
    cognitive_load: "Number of competing choices and decisions presented at once.",
    hierarchy: "Whether visual weight matches business priority, and how dense key screens are.",
    trust: "Presence of proof, credibility and security signals at decision points.",
  };
  const ordered = [...findings].sort((a, b) => b.impact - a.impact);
  const top = ordered.slice(0, 3);
  const sorted = Object.entries(scores).sort((a, b) => a[1] - b[1]);
  const weakest = sorted.slice(0, 2).map(([k]) => k.replace("_", " "));
  return {
    executiveSummary:
      `Against the goal to ${goalLabel}, ${product} has ${countLabel(findings.filter((f) => f.severity === "critical").length, "critical blocker")} and ${countLabel(findings.filter((f) => f.severity === "high").length, "high-severity issue")}. ` +
      `The weakest areas are ${weakest.join(" and ")}. ` +
      (top[0] ? `The most valuable change is to address “${top[0].title.toLowerCase()}”, which can be shipped ${top[0].effort === "low" ? "within days" : "within a sprint"}. ` : "") +
      "Findings are prioritized by expected growth impact relative to effort." +
      (home ? "" : " This review is based on screen layout only; page copy and trust signals were not machine-readable from the uploaded images."),
    subScores: (Object.keys(scores) as SubScoreKey[]).map((key) => ({ key, score: Math.max(18, Math.min(96, scores[key])), rationale: rationale[key] })),
    criticalIssues: top.map((f) => ({
      findingId: f.id,
      title: f.title,
      impactLevel: f.severity === "critical" ? "critical" : "high",
      businessImpact: f.businessImpact,
      fix: f.recommendedFix,
    })),
    findings,
    screenshotLabels: screens.map((s) => s.label),
  };
}
