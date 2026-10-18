import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { Logo } from "./Logo";
import { SignOutButton } from "./SignOutButton";

export async function SiteHeader({ variant = "marketing" }: { variant?: "marketing" | "app" }) {
  const user = await currentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/80 backdrop-blur no-print">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Logo />
        <nav className="flex items-center gap-4 sm:gap-6 text-sm whitespace-nowrap">
          {variant === "marketing" && (
            <>
              <Link href="/#what" className="hidden lg:inline text-muted hover:text-fg">What we audit</Link>
              <Link href="/#how" className="hidden md:inline text-muted hover:text-fg">How it works</Link>
              <Link href="/#pricing" className="hidden md:inline text-muted hover:text-fg">Pricing</Link>
              <Link href="/sample" className="hidden md:inline text-muted hover:text-fg">Sample report</Link>
            </>
          )}
          {user ? (
            <>
              <Link href="/dashboard" className="text-muted hover:text-fg">Dashboard</Link>
              {user.plan === "pro" ? (
                <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[11px] uppercase tracking-wider text-accent">Pro</span>
              ) : (
                <Link href="/upgrade" className="text-accent hover:text-accent-strong">Go Pro</Link>
              )}
              <span className="hidden sm:inline"><SignOutButton /></span>
            </>
          ) : (
            <>
              <Link href="/login" className="text-muted hover:text-fg">Sign in</Link>
              <Link href="/signup" className="rounded-lg bg-accent px-3 sm:px-4 py-2 text-white font-semibold hover:bg-accent-strong">
                <span className="sm:hidden">Start audit</span>
                <span className="hidden sm:inline">Start Product Audit</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
