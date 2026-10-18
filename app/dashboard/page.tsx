import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { SiteHeader } from "@/components/SiteHeader";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FREE_SCAN_LIMIT, labelFor, PRODUCT_TYPES } from "@/lib/config";
import { scoreBand } from "@/lib/report";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ upgraded?: string }> }) {
  const user = await requireUser();
  const { upgraded } = await searchParams;
  const audits = await prisma.audit.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  const canScan = user.plan === "pro" || audits.length < FREE_SCAN_LIMIT;

  return (
    <>
      <SiteHeader variant="app" />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
        {upgraded && (
          <div className="mb-8 fade-up rounded-xl border border-good/30 bg-good/10 px-4 py-3 text-sm font-medium">You are on Pro. Full reports, the action plan and exports are now unlocked.</div>
        )}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <Eyebrow>Dashboard</Eyebrow>
            <h1 className="mt-3 font-display text-3xl sm:text-4xl tracking-tight">Your audits</h1>
            <p className="mt-2 text-sm text-muted">
              <span className="sm:hidden">{user.email} · <SignOutButton /><br /></span>
              {user.plan === "pro"
                ? "Pro plan · unlimited scans with full reports"
                : `Free plan · ${Math.min(audits.length, FREE_SCAN_LIMIT)} of ${FREE_SCAN_LIMIT} free scan used`}
            </p>
          </div>
          {canScan ? (
            <ButtonLink href="/audits/new" className="px-5 py-3">Start New Audit</ButtonLink>
          ) : (
            <ButtonLink href="/upgrade" variant="accent" className="px-5 py-3">Go Pro for unlimited scans</ButtonLink>
          )}
        </div>

        {audits.length === 0 ? (
          <div className="mt-12 rounded-3xl border-2 border-dashed border-line-strong p-8 sm:p-14 text-center">
            <h2 className="text-lg font-medium">No audits yet</h2>
            <p className="mt-2 text-sm text-muted max-w-md mx-auto">Start with a live URL. Most scans of a public site finish in under two minutes.</p>
            <ButtonLink href="/audits/new" className="mt-6">Start New Audit</ButtonLink>
          </div>
        ) : (
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {audits.map((a) => {
              const href = a.status === "complete" ? `/audits/${a.id}` : `/audits/${a.id}/processing`;
              const band = a.growthScore != null ? scoreBand(a.growthScore) : null;
              return (
                <Link key={a.id} href={href} className="lift group rounded-2xl border border-line bg-white p-6 shadow-sm flex flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-medium truncate">{a.productName}</h3>
                      <p className="mt-1 text-xs text-subtle truncate">{a.productUrl || labelFor(PRODUCT_TYPES, a.productType)}</p>
                    </div>
                    {a.growthScore != null ? (
                      <div className="text-right">
                        <p className={`text-4xl font-extrabold leading-none ${a.growthScore >= 80 ? "text-good" : a.growthScore >= 60 ? "text-high" : "text-critical"}`}>{a.growthScore}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-subtle">Growth score</p>
                      </div>
                    ) : (
                      <span className={`text-[11px] uppercase tracking-wider ${a.status === "failed" ? "text-critical" : "text-accent"}`}>
                        {a.status === "failed" ? "Failed" : "Processing"}
                      </span>
                    )}
                  </div>
                  {band && (
                    <div className="mt-5 h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className={`bar-grow h-2 rounded-full ${band.tone === "good" ? "bg-good" : band.tone === "warn" ? "bg-high" : "bg-critical"}`}
                        style={{ width: `${a.growthScore}%` }}
                      />
                    </div>
                  )}
                  <div className="mt-6 pt-4 border-t border-line flex items-center justify-between text-sm">
                    <span className="text-muted">{a.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    <span className="font-semibold text-accent transition-transform group-hover:translate-x-0.5">{a.status === "complete" ? "View report" : "View status"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
