import { z } from "zod";

// The report schema is shared by the Claude engine (as its structured-output format),
// the heuristic engine, the report page, the PDF and the Notion export.

export const SUB_SCORES = [
  { key: "value_proposition", label: "Value proposition clarity", weight: 0.22 },
  { key: "onboarding", label: "Onboarding friction", weight: 0.2 },
  { key: "conversion", label: "Conversion path", weight: 0.18 },
  { key: "cognitive_load", label: "Cognitive load", weight: 0.14 },
  { key: "hierarchy", label: "Hierarchy and information density", weight: 0.13 },
  { key: "trust", label: "Trust signals", weight: 0.13 },
] as const;

export type SubScoreKey = (typeof SUB_SCORES)[number]["key"];

export const BoxSchema = z.object({
  screenshotIndex: z.number().int().describe("Index into the provided screenshots, starting at 0"),
  x: z.number().describe("Left edge, percent of image width (0-100)"),
  y: z.number().describe("Top edge, percent of image height (0-100)"),
  w: z.number().describe("Width, percent of image width"),
  h: z.number().describe("Height, percent of image height"),
});

export const FindingSchema = z.object({
  id: z.string().describe("Short stable id such as F1, F2"),
  category: z.enum(["onboarding", "dashboard", "core_flow", "messaging", "heuristics", "strategic_risks"]),
  title: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  problem: z.string(),
  whyItMatters: z.string(),
  businessImpact: z.string(),
  recommendedFix: z.string(),
  impact: z.number().int().describe("Growth impact 1-5"),
  effort: z.enum(["low", "medium", "high"]),
  annotation: BoxSchema.nullable().describe("Where on which screenshot the issue is visible, or null"),
  annotationNote: z.string().describe("Short comment shown next to the marker on the screenshot"),
});

export const ReportSchema = z.object({
  executiveSummary: z.string(),
  subScores: z.array(
    z.object({
      key: z.enum(["value_proposition", "onboarding", "conversion", "cognitive_load", "hierarchy", "trust"]),
      score: z.number().int().describe("0-100"),
      rationale: z.string(),
    }),
  ),
  criticalIssues: z
    .array(
      z.object({
        findingId: z.string().describe("Id of the finding this issue is based on"),
        title: z.string(),
        impactLevel: z.enum(["critical", "high"]),
        businessImpact: z.string(),
        fix: z.string(),
      }),
    )
    .describe("Exactly three, ordered by growth impact"),
  findings: z.array(FindingSchema),
  screenshotLabels: z.array(z.string()).describe("A short label for each screenshot, same order as provided"),
});

export type Box = z.infer<typeof BoxSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type ReportCore = z.infer<typeof ReportSchema>;

export type ActionItem = { findingId: string; title: string; impact: number; effort: Finding["effort"] };

export type Report = ReportCore & {
  growthScore: number;
  actionPlan: {
    highImpactLowEffort: ActionItem[];
    highImpactHighEffort: ActionItem[];
    quickWins: ActionItem[];
  };
  generatedAt: string;
  engine: "claude" | "heuristic";
  screenshots: { assetId: string; label: string; width: number; height: number; src: string }[];
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function computeGrowthScore(subScores: ReportCore["subScores"]) {
  let total = 0;
  let weights = 0;
  for (const def of SUB_SCORES) {
    const s = subScores.find((x) => x.key === def.key);
    if (!s) continue;
    total += clamp(s.score, 0, 100) * def.weight;
    weights += def.weight;
  }
  return weights ? Math.round(total / weights) : 0;
}

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export function sortFindings(findings: Finding[]) {
  return [...findings].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.impact - a.impact,
  );
}

export function buildActionPlan(findings: Finding[]): Report["actionPlan"] {
  const plan: Report["actionPlan"] = { highImpactLowEffort: [], highImpactHighEffort: [], quickWins: [] };
  for (const f of sortFindings(findings)) {
    const item = { findingId: f.id, title: f.title, impact: f.impact, effort: f.effort };
    if (f.impact >= 4 && f.effort === "low") plan.highImpactLowEffort.push(item);
    else if (f.impact >= 4) plan.highImpactHighEffort.push(item);
    else if (f.effort !== "high") plan.quickWins.push(item);
    else plan.highImpactHighEffort.push(item);
  }
  return plan;
}

// Normalizes model or heuristic output into a consistent, renderable report.
export function finalizeReport(
  core: ReportCore,
  screenshots: { assetId: string; width: number; height: number; label: string }[],
  engine: Report["engine"],
): Report {
  const subScores = SUB_SCORES.map((def) => {
    const s = core.subScores.find((x) => x.key === def.key);
    return { key: def.key, score: clamp(Math.round(s?.score ?? 50), 0, 100), rationale: s?.rationale ?? "" };
  });
  const findings = core.findings.map((f, i) => {
    const a = f.annotation;
    const valid = a && a.screenshotIndex >= 0 && a.screenshotIndex < screenshots.length;
    return {
      ...f,
      id: f.id || `F${i + 1}`,
      impact: clamp(Math.round(f.impact), 1, 5),
      annotation: valid
        ? {
            screenshotIndex: a.screenshotIndex,
            x: clamp(a.x, 0, 98),
            y: clamp(a.y, 0, 98),
            w: clamp(a.w, 2, 100 - clamp(a.x, 0, 98)),
            h: clamp(a.h, 2, 100 - clamp(a.y, 0, 98)),
          }
        : null,
    };
  });
  const ids = new Set(findings.map((f) => f.id));
  let critical = core.criticalIssues.filter((c) => ids.has(c.findingId)).slice(0, 3);
  if (critical.length < 3) {
    for (const f of sortFindings(findings)) {
      if (critical.length >= 3) break;
      if (critical.some((c) => c.findingId === f.id)) continue;
      critical.push({
        findingId: f.id,
        title: f.title,
        impactLevel: f.severity === "critical" ? "critical" : "high",
        businessImpact: f.businessImpact,
        fix: f.recommendedFix,
      });
    }
  }
  critical = critical.slice(0, 3);
  return {
    ...core,
    subScores,
    findings,
    criticalIssues: critical,
    growthScore: computeGrowthScore(subScores),
    actionPlan: buildActionPlan(findings),
    generatedAt: new Date().toISOString(),
    engine,
    screenshots: screenshots.map((s, i) => ({
      ...s,
      label: core.screenshotLabels[i] || s.label,
      src: `/api/assets/${s.assetId}`,
    })),
  };
}

export function scoreBand(score: number) {
  if (score >= 80) return { label: "Growth ready", tone: "good" as const };
  if (score >= 60) return { label: "Gaps limiting growth", tone: "warn" as const };
  return { label: "Critical blockers", tone: "bad" as const };
}
