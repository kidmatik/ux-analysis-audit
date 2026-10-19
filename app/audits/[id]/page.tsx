import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { ReportView } from "@/components/report/ReportView";
import { requireUser } from "@/lib/auth";
import { loadAuditForView } from "@/lib/access";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const data = await loadAuditForView({ id });
  if (!data) notFound();
  if (data.audit.status !== "complete" || !data.report) redirect(`/audits/${id}/processing`);
  return (
    <>
      <SiteHeader variant="app" />
      <ReportView audit={data.audit} report={data.report} redesign={data.redesign} mode="owner" />
    </>
  );
}
