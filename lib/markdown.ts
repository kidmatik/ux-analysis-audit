import { FINDING_CATEGORIES } from "./config";
import { SUB_SCORES, sortFindings, type Report } from "./report";
import { VISIBILITY_SUB_SCORES } from "./visibility";

const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;
const cell = (s: string) => s.replace(/\|/g, "/").replace(/\n/g, " ");

// Markdown export. Notion imports it directly (Settings > Import > Markdown & CSV) or it can be pasted into a page.
export function reportToMarkdown(productName: string, report: Report, shareUrl?: string) {
  const L: string[] = [];
  L.push(`# UX Analysis Audit: ${productName}`, "");
  L.push(`**Growth Readiness Score: ${report.growthScore} / 100**`, "");
  L.push(`_Generated ${new Date(report.generatedAt).toDateString()}${shareUrl ? ` · [View interactive report](${shareUrl})` : ""}_`, "");
  L.push("## Executive summary", "", report.executiveSummary, "");
  L.push("## Sub-scores", "", "| Area | Score | What it measures |", "| --- | --- | --- |");
  for (const s of report.subScores) {
    L.push(`| ${SUB_SCORES.find((d) => d.key === s.key)?.label ?? s.key} | ${s.score} | ${s.rationale.replace(/\|/g, "/")} |`);
  }
  L.push("", "## Top 3 critical issues", "");
  report.criticalIssues.forEach((c, i) => {
    L.push(`### ${i + 1}. ${c.title}`, `**Impact:** ${c.impactLevel}`, "", `**Business impact.** ${c.businessImpact}`, "", `**Fix.** ${c.fix}`, "");
  });
  L.push("## Detailed findings", "");
  for (const cat of FINDING_CATEGORIES) {
    const items = sortFindings(report.findings.filter((f) => f.category === cat.value));
    if (!items.length) continue;
    L.push(`### ${cat.label}`, "");
    for (const f of items) {
      const where = f.annotation ? ` (see ${report.screenshots[f.annotation.screenshotIndex]?.label ?? "screenshot"})` : "";
      L.push(`#### ${f.id} · ${f.title}`, `Severity: ${f.severity} · Impact ${f.impact}/5 · Effort ${f.effort}${where}`, "");
      L.push(`- **Problem:** ${f.problem}`, `- **Why it matters:** ${f.whyItMatters}`, `- **Business impact:** ${f.businessImpact}`, `- **Recommended fix:** ${f.recommendedFix}`, "");
    }
  }
  const v = report.visibility;
  if (v) {
    L.push("## AI & search visibility", "");
    L.push(`**Visibility score: ${v.score} / 100** · ${v.origin} · ${v.pages.length} pages crawled`, "");
    L.push(`robots.txt: ${v.files.robotsTxt ? "found" : "missing"} · Sitemap: ${v.files.sitemap ? "found" : "missing"} · llms.txt: ${v.files.llmsTxt ? "found" : "missing"}`, "");
    L.push("| Area | Score |", "| --- | --- |");
    for (const s of v.subScores) L.push(`| ${VISIBILITY_SUB_SCORES.find((d) => d.key === s.key)?.label ?? s.key} | ${s.score} |`);
    L.push("", "### AI and search crawler access", "", "| Crawler | Used by | Access | Deciding rule |", "| --- | --- | --- | --- |");
    for (const b of v.bots) L.push(`| ${b.name} | ${b.engine} | ${b.allowed ? "Allowed" : "Blocked"} | ${cell(b.rule)} |`);
    const failing = v.checks.filter((c) => c.status !== "pass").sort((a, b) => Number(a.status === "warn") - Number(b.status === "warn") || SEV_RANK[a.severity] - SEV_RANK[b.severity]);
    L.push("", "### Visibility issues", "");
    if (!failing.length) L.push("All visibility checks pass.", "");
    for (const c of failing) {
      L.push(`#### ${c.label}`, `${c.track.toUpperCase()} · ${c.status === "fail" ? "Fail" : "Warning"} · Severity: ${c.severity}`, "", c.detail, "");
      if (c.fix) L.push(`**Fix.** ${c.fix}`, "");
    }
  }
  L.push("## Prioritized action plan", "");
  const plan: [string, Report["actionPlan"]["quickWins"]][] = [
    ["High impact / Low effort", report.actionPlan.highImpactLowEffort],
    ["High impact / High effort", report.actionPlan.highImpactHighEffort],
    ["Quick wins", report.actionPlan.quickWins],
  ];
  for (const [title, items] of plan) {
    L.push(`### ${title}`, "");
    if (!items.length) L.push("- None", "");
    items.forEach((a) => L.push(`- [ ] ${a.title} (${a.findingId}, impact ${a.impact}/5, effort ${a.effort})`));
    L.push("");
  }
  return L.join("\n");
}
