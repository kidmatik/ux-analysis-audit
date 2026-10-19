import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { ReportView } from "@/components/report/ReportView";
import { loadAuditForView } from "@/lib/access";
import { ensureSample, SAMPLE_TOKEN } from "@/lib/sample";

export const metadata = { robots: { index: false } };

export default async function SharedReport({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Keeps the stored sample in step with lib/sample.ts after an update.
  if (token === SAMPLE_TOKEN) await ensureSample();
  const data = await loadAuditForView({ token });
  if (!data?.report) notFound();
  return (
    <>
      <SiteHeader />
      <ReportView audit={data.audit} report={data.report} redesign={data.redesign} mode={token === SAMPLE_TOKEN ? "sample" : "shared"} shareToken={token} />
    </>
  );
}
