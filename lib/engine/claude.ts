import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { labelFor, FOCUS_AREAS, GROWTH_STAGES, PRIMARY_GOALS, PRODUCT_TYPES } from "../config";
import { ReportSchema, SUB_SCORES, type ReportCore } from "../report";
import { readStored } from "../storage";
import type { AuditContext } from "./heuristic";
import type { PageSignals, Screen } from "./types";

export const claudeEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const SYSTEM = `You are a senior product strategist producing an executive UX and growth audit for a SaaS company.
Your audience is founders, product leaders and investors. Write in a premium, direct, strategic register: no filler, no generic UX advice, no emojis.
Every finding must be specific to what is visible in the screenshots or present in the captured page data. Quote real copy where relevant.

Evaluate, in order of importance:
1. Clarity of the value proposition (who it is for, what outcome, why this over alternatives)
2. Onboarding friction (steps, fields, time and effort to first value)
3. Conversion blockers (primary path, competing actions, missing next steps)
4. Cognitive overload (choices, density, competing visual weight)
5. Hierarchy and information density (does visual weight match business priority)
6. Trust signals (proof, credibility, security, pricing transparency)

For each finding give: the problem as observed, why it matters to user behaviour, the business impact (revenue, activation, retention, sales cycle, fundraising), and a concrete fix a team could ship.
Rate impact 1-5 by expected growth impact, and effort low/medium/high.
Pin each finding to the screenshot where it is visible with a tight bounding box in percent of that image (x, y, w, h from the top-left, 0-100). Use the detected element boxes provided as anchors when they match; otherwise estimate from the image. Use null only when the issue is not visible on any screenshot.
Write a short annotationNote (under 8 words) shown next to the marker.
Produce 8 to 14 findings spread across categories relevant to the product, and exactly three critical issues that reference the most growth-limiting findings by id.
Score each sub-score 0-100 where 90+ is best-in-class, 70 is competent with gaps, and below 50 means it is actively blocking growth.`;

function describeScreens(screens: Screen[]) {
  return screens
    .map((s, i) => {
      const els = s.elements
        .slice(0, 25)
        .map((e) => `    - ${e.kind} "${e.text.slice(0, 60)}" box(x=${e.x.toFixed(1)}, y=${e.y.toFixed(1)}, w=${e.w.toFixed(1)}, h=${e.h.toFixed(1)})`)
        .join("\n");
      return `Screenshot ${i}: ${s.label} (${s.width}x${s.height})${s.pageUrl ? ` at ${s.pageUrl}` : ""}\n${els || "    (no detected elements)"}`;
    })
    .join("\n\n");
}

function describeSignals(signals: PageSignals[]) {
  return signals
    .map(
      (p) => `Page ${p.url}
  title: ${p.title}
  meta description: ${p.metaDescription || "(none)"}
  H1: ${p.h1.join(" | ") || "(none)"}
  headings: ${p.headings.slice(0, 10).join(" | ")}
  CTAs: ${p.ctas.join(" | ")}
  CTAs above the fold: ${p.aboveFoldCtas.join(" | ") || "(none)"}
  navigation: ${p.navItems.join(" | ")}
  words total / above fold: ${p.wordCount} / ${p.aboveFoldWords}
  form fields: ${p.formFields}; pricing link: ${p.hasPricingLink}; testimonials: ${p.hasTestimonials}; logo wall: ${p.hasLogoWall}; quantified proof: ${p.hasNumbersProof}; security signals: ${p.hasSecuritySignals}; trial or demo offer: ${p.hasDemoOrTrial}
  load time: ${p.loadMs}ms`,
    )
    .join("\n\n");
}

export async function claudeReport(ctx: AuditContext, screens: Screen[], signals: PageSignals[], extraNotes: string[]): Promise<ReportCore> {
  const client = new Anthropic();
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const [i, s] of screens.entries()) {
    const data = (await readStored(s.path)).toString("base64");
    content.push({ type: "text", text: `Screenshot ${i}: ${s.label}` });
    content.push({ type: "image", source: { type: "base64", media_type: s.mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data } });
  }
  content.push({
    type: "text",
    text: `Product: ${ctx.productName}
URL: ${ctx.productUrl || "(not provided)"}
Product type: ${labelFor(PRODUCT_TYPES, ctx.productType)}
Growth stage: ${labelFor(GROWTH_STAGES, ctx.growthStage)}
Primary goal: ${labelFor(PRIMARY_GOALS, ctx.primaryGoal)}
Focus areas: ${ctx.focusAreas.map((f) => labelFor(FOCUS_AREAS, f)).join(", ") || "all"}
Access method: ${ctx.accessMethod}
${extraNotes.length ? `Reviewer notes: ${extraNotes.join(" ")}` : ""}

Sub-score keys: ${SUB_SCORES.map((s) => `${s.key} (${s.label})`).join(", ")}

Detected elements per screenshot:
${describeScreens(screens)}

Captured page data:
${describeSignals(signals) || "(none; analysis is from images only)"}

Produce the audit.`,
  });

  const response = await client.beta.messages.parse({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: betaZodOutputFormat(ReportSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined to analyze this product.");
  if (!response.parsed_output) throw new Error(`No structured output (stop reason: ${response.stop_reason})`);
  return response.parsed_output;
}
