import { currentUser } from "./auth";
import { prisma } from "./prisma";
import { gateReport } from "./gate";
import type { Report } from "./report";

// Loads an audit for viewing either by its owner or by a share token, and gates the
// report by the owner's plan.
export async function loadAuditForView(opts: { id?: string; token?: string }) {
  const audit = opts.token
    ? await prisma.audit.findUnique({ where: { shareToken: opts.token }, include: { user: true } })
    : opts.id
      ? await prisma.audit.findUnique({ where: { id: opts.id }, include: { user: true } })
      : null;
  if (!audit) return null;
  if (!opts.token) {
    const user = await currentUser();
    if (!user || user.id !== audit.userId) return null;
  }
  const raw = audit.report ? (JSON.parse(audit.report) as Report) : null;
  const report = raw ? gateReport(raw, audit.user.plan) : null;
  if (report && opts.token) {
    report.screenshots = report.screenshots.map((s) => (s.src ? { ...s, src: `${s.src}?t=${opts.token}` } : s));
  }
  return { audit, report, plan: audit.user.plan };
}
