import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Wizard } from "@/components/Wizard";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACCESS_METHODS, FREE_SCAN_LIMIT } from "@/lib/config";

export default async function NewAudit({ searchParams }: { searchParams: Promise<{ url?: string; method?: string }> }) {
  const { url, method } = await searchParams;
  const initialMethod = ACCESS_METHODS.find((m) => m.value === method)?.value ?? "url";
  const user = await requireUser();
  if (user.plan !== "pro" && (await prisma.audit.count({ where: { userId: user.id } })) >= FREE_SCAN_LIMIT) redirect("/upgrade");
  return (
    <>
      <SiteHeader variant="app" />
      <Wizard figmaServerToken={Boolean(process.env.FIGMA_TOKEN)} initialUrl={normalizeUrl(url)} initialMethod={initialMethod} />
    </>
  );
}

function normalizeUrl(raw?: string) {
  const v = raw?.trim();
  if (!v) return "";
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return "";
  }
}
