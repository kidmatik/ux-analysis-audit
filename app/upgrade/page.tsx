import { SiteHeader } from "@/components/SiteHeader";
import { UpgradeButton } from "@/components/UpgradeButton";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { demoUpgradeAllowed } from "@/lib/billing";
import { PRICING } from "@/lib/config";

export default async function Upgrade() {
  const user = await currentUser();
  const pro = PRICING.find((p) => p.key === "pro")!;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <Eyebrow>Pro</Eyebrow>
        <h1 className="mt-4 font-display text-3xl sm:text-5xl tracking-tight">The full report, for every release.</h1>
        <p className="mt-4 text-lg text-muted">Unlimited scans and the complete executive report, including every annotated finding and a prioritized action plan with the specific changes to make.</p>
        <div className="mt-10 rounded-lg border border-accent/50 bg-surface p-8">
          <p className="flex items-baseline gap-2">
            <span className="text-6xl font-extrabold">{pro.price}</span>
            <span className="text-muted">{pro.cadence}</span>
          </p>
          <ul className="mt-6 space-y-2.5 text-sm">
            {pro.features.map((f) => (
              <li key={f} className="flex gap-3"><span className="mt-2 h-1 w-3 shrink-0 bg-accent" />{f}</li>
            ))}
          </ul>
          <div className="mt-8">
            {user?.plan === "pro" ? (
              <ButtonLink href="/dashboard" variant="secondary">You are on Pro. Go to dashboard</ButtonLink>
            ) : user ? (
              <UpgradeButton returnTo="/dashboard" />
            ) : (
              <ButtonLink href="/signup?callbackUrl=/upgrade" variant="accent">Create an account to upgrade</ButtonLink>
            )}
          </div>
          {demoUpgradeAllowed() && user?.plan !== "pro" && (
            <p className="mt-4 text-xs text-subtle">Billing is in test mode on this server: upgrading activates Pro without payment.</p>
          )}
        </div>
      </main>
    </>
  );
}
