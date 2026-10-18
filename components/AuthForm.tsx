"use client";
import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Field, inputCls } from "./ui";

export function AuthForm({ mode, googleEnabled }: { mode: "login" | "signup"; googleEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || (mode === "signup" ? "/audits/new" : "/dashboard");
  const [error, setError] = useState<string | null>(params.get("error") ? "Sign-in failed. Try again." : null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    if (mode === "signup") {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fd.get("name"), email, password }),
      });
      if (!res.ok) {
        setError((await res.json()).error);
        setLoading(false);
        return;
      }
    }
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setError("Email or password is incorrect.");
      setLoading(false);
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-display text-3xl sm:text-4xl tracking-tight">{mode === "login" ? "Welcome back" : "Start your product audit"}</h1>
      <p className="mt-2 text-sm text-muted">
        {mode === "login" ? "Sign in to view your audits." : "Create an account. Your first scan is free."}
      </p>

      <button
        type="button"
        disabled={!googleEnabled}
        onClick={() => signIn("google", { callbackUrl })}
        title={googleEnabled ? undefined : "Google sign-in is not configured on this server"}
        className="mt-8 w-full inline-flex items-center justify-center gap-3 rounded-md border border-line-strong px-4 py-2.5 text-sm font-medium hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
        </svg>
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-3 text-xs text-subtle">
        <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === "signup" && (
          <Field label="Full name">
            <input name="name" required className={inputCls} autoComplete="name" />
          </Field>
        )}
        <Field label="Work email">
          <input name="email" type="email" required className={inputCls} autoComplete="email" />
        </Field>
        <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
          <input name="password" type="password" required minLength={mode === "signup" ? 8 : undefined} className={inputCls} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        </Field>
        {error && <p className="text-sm text-critical">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Please wait" : mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        {mode === "login" ? (
          <>New here? <Link href="/signup" className="text-fg underline underline-offset-4">Create an account</Link></>
        ) : (
          <>Already have an account? <Link href="/login" className="text-fg underline underline-offset-4">Sign in</Link></>
        )}
      </p>
    </div>
  );
}
