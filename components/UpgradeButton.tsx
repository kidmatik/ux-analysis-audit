"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { btn } from "./ui";

export function UpgradeButton({ returnTo, label = "Go Pro, $39/month", className = "" }: { returnTo?: string; label?: string; className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/billing/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnTo: returnTo ?? window.location.pathname }),
    });
    if (res.status === 401) return router.push(`/signup?callbackUrl=${encodeURIComponent("/upgrade")}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error);
      setLoading(false);
      return;
    }
    if (json.url.startsWith("http")) window.location.href = json.url;
    else {
      router.push(json.url);
      router.refresh();
    }
  }
  return (
    <div>
      <button onClick={go} disabled={loading} className={`${btn("accent")} ${className}`}>
        {loading ? "Redirecting" : label}
      </button>
      {error && <p className="mt-2 text-sm text-critical">{error}</p>}
    </div>
  );
}
