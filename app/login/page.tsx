import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { Logo } from "@/components/Logo";
import { currentUser, googleEnabled } from "@/lib/auth";

export default async function Page() {
  if (await currentUser()) redirect("/dashboard");
  return (
    <main className="min-h-[80vh] grid lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 lg:px-16">
        <Logo />
        <div className="flex-1 flex items-center py-16">
          <Suspense>
            <AuthForm mode="login" googleEnabled={googleEnabled} />
          </Suspense>
        </div>
      </div>
      <div className="hidden lg:flex relative border-l border-line bg-surface overflow-hidden items-end p-16">
        <div className="grid-bg absolute inset-0" />
        <div className="relative max-w-md">
          <p className="text-3xl font-bold tracking-tight leading-snug">Every audit delivers a Growth Readiness Score, the three issues costing you the most, and the exact place on screen to fix them.</p>
          <ul className="mt-8 space-y-2 text-sm text-muted">
            <li>Credentials are encrypted and deleted after analysis</li>
            <li>Websites, landing pages, SaaS apps and Figma files</li>
            <li>Executive-ready PDF and shareable report</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
