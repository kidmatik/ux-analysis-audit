import Link from "next/link";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line mt-24 no-print">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 py-10 flex flex-col md:flex-row gap-6 md:items-center md:justify-between text-sm text-muted">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <Logo small />
          <nav className="flex items-center gap-6 whitespace-nowrap">
            <Link href="/sample" className="transition-colors hover:text-fg">Sample report</Link>
            <Link href="/#pricing" className="transition-colors hover:text-fg">Pricing</Link>
          </nav>
        </div>
        <p>
          Powered by <span className="text-fg font-medium">Matan.Design</span>
        </p>
      </div>
    </footer>
  );
}
