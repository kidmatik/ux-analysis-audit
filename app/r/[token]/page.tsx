import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { ReportView } from "@/components/report/ReportView";
import { loadAuditForView } from "@/lib/access";
import { SAMPLE_TOKEN } from "@/lib/sample";

export const metadata = { robots: { index: false } };

export default async function SharedReport({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await loadAuditForView({ token });
  if (!data?.report) notFound();
  return (
    <>
      <SiteHeader />
      <ReportView audit={data.audit} report={data.report} mode={token === SAMPLE_TOKEN ? "sample" : "shared"} shareToken={token} />
    </>
  );
}
