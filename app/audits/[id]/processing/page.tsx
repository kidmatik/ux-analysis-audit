import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Processing } from "@/components/Processing";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const audit = await prisma.audit.findFirst({ where: { id, userId: user.id } });
  if (!audit) notFound();
  if (audit.status === "complete") redirect(`/audits/${id}`);
  return (
    <>
      <SiteHeader variant="app" />
      <Processing id={id} productName={audit.productName} initial={{ status: audit.status, stage: audit.stage, error: audit.error }} />
    </>
  );
}
