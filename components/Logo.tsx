import Link from "next/link";

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-fg">
      <span className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-white" />
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-cta ring-2 ring-white" />
      </span>
      <span className={`${small ? "text-sm" : "text-[15px]"} font-bold tracking-tight whitespace-nowrap`}>
        UX Analysis Audit
      </span>
    </Link>
  );
}
