"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function HeroAuditForm({ signedIn, size = "lg" }: { signedIn: boolean; size?: "lg" | "md" }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    let value = url.trim();
    if (!value) return setError("Enter your website or product URL.");
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    try {
      const u = new URL(value);
      if (!u.hostname.includes(".")) throw new Error();
    } catch {
      return setError("That does not look like a valid URL.");
    }
    const next = `/audits/new?url=${encodeURIComponent(value)}`;
    router.push(signedIn ? next : `/signup?callbackUrl=${encodeURIComponent(next)}`);
  }

  const lg = size === "lg";
  return (
    <form onSubmit={submit} className="w-full">
      <div
        className={`flex items-center gap-2 rounded-2xl border border-line-strong bg-white shadow-[0_8px_30px_rgb(14_19_37/0.08)] focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15 transition ${lg ? "p-2 pl-5" : "p-1.5 pl-4"}`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-subtle" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
        </svg>
        <input
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null); }}
          placeholder="yourwebsite.com"
          aria-label="Website or product URL"
          className={`min-w-0 flex-1 bg-transparent text-fg placeholder:text-subtle focus:outline-none ${lg ? "text-lg py-3" : "text-base py-2"}`}
        />
        <button
          type="submit"
          className={`shrink-0 rounded-xl bg-cta font-semibold text-white hover:bg-cta-strong transition-colors ${lg ? "px-6 py-3.5 text-base" : "px-4 py-2.5 text-sm"}`}
        >
          <span className="hidden sm:inline">Start Product Audit</span>
          <span className="sm:hidden">Audit</span>
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-critical text-left">{error}</p>}
    </form>
  );
}
