import type { Report } from "./report";

export type ViewReport = Report & { locked: boolean; lockedCounts?: { findings: number; screenshots: number } };

const LOCKED = "";

// Free accounts get a teaser: score, sub-scores, the three critical issues, an annotated
// preview and the visibility scan without its fixes. Recommended fixes, full finding detail and
// the action plan are Pro only. Locked content is removed on the server so it never reaches the browser.
export function gateReport(report: Report, plan: string): ViewReport {
  if (plan === "pro") return { ...report, locked: false };
  const previewIds = new Set(report.criticalIssues.map((c) => c.findingId));
  // Screens that illustrate the three critical issues stay visible in the teaser.
  const previewShots = new Set(
    report.criticalIssues
      .map((c) => report.findings.find((f) => f.id === c.findingId)?.annotation?.screenshotIndex)
      .filter((i): i is number => i !== undefined),
  );
  if (!previewShots.size) previewShots.add(0);
  return {
    ...report,
    locked: true,
    lockedCounts: { findings: report.findings.length - previewIds.size, screenshots: Math.max(0, report.screenshots.length - previewShots.size) },
    criticalIssues: report.criticalIssues.map((c) => ({ ...c, fix: LOCKED })),
    findings: report.findings.map((f) =>
      previewIds.has(f.id)
        ? { ...f, recommendedFix: LOCKED }
        : { ...f, problem: LOCKED, whyItMatters: LOCKED, businessImpact: LOCKED, recommendedFix: LOCKED, annotation: null, annotationNote: "" },
    ),
    actionPlan: { highImpactLowEffort: [], highImpactHighEffort: [], quickWins: [] },
    screenshots: report.screenshots.map((s, i) => (previewShots.has(i) ? s : { ...s, src: "" })),
    // Visibility scores, bot access, crawled pages and what each check found stay visible; the fixes are Pro.
    visibility: report.visibility ? { ...report.visibility, checks: report.visibility.checks.map((c) => ({ ...c, fix: LOCKED })) } : report.visibility,
  };
}
