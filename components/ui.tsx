import Link from "next/link";
import type { ComponentProps } from "react";

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost" | "accent" | "cta" | "light" }) {
  return <button className={`${btn(variant)} ${className}`} {...props} />;
}

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" | "ghost" | "accent" | "cta" | "light" }) {
  return <Link className={`${btn(variant)} ${className}`} {...props} />;
}

export function btn(variant: "primary" | "secondary" | "ghost" | "accent" | "cta" | "light") {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none";
  if (variant === "primary") return `${base} bg-accent text-white hover:bg-accent-strong`;
  if (variant === "accent") return `${base} bg-accent text-white hover:bg-accent-strong`;
  if (variant === "cta") return `${base} bg-cta text-white hover:bg-cta-strong`;
  if (variant === "light") return `${base} bg-white text-fg hover:bg-white/90`;
  if (variant === "secondary") return `${base} border border-line-strong bg-white text-fg hover:bg-surface`;
  return `${base} text-muted hover:text-fg`;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-fg mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-subtle mt-1.5">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line-strong bg-white px-3 py-2.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs font-semibold uppercase tracking-[0.14em] text-accent ${className}`}>{children}</p>;
}

export function SeverityPill({ severity }: { severity: string }) {
  const cls =
    severity === "critical"
      ? "text-white border-critical bg-critical"
      : severity === "high"
        ? "text-white border-high bg-high"
        : severity === "medium"
          ? "text-white border-medium bg-medium"
          : "text-muted border-line-strong bg-surface-2";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${cls}`}>{severity}</span>;
}
