import { NextResponse } from "next/server";
import { loadAuditForView } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { readStored } from "@/lib/storage";
import { renderReportPdf, type PdfImage } from "@/lib/pdf";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("t") ?? undefined;
  const data = await loadAuditForView(token ? { token } : { id });
  if (!data?.report || data.audit.id !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (data.report.locked) return NextResponse.json({ error: "PDF export is part of Pro." }, { status: 402 });
  const assets = await prisma.asset.findMany({ where: { auditId: id } });
  const images: PdfImage[] = await Promise.all(
    data.report.screenshots.map(async (shot) => {
      const asset = assets.find((a) => a.id === shot.assetId);
      if (!asset || !/png|jpe?g/.test(asset.mimeType)) return null;
      const buf = await readStored(asset.path).catch(() => null);
      return buf ? { data: buf, format: asset.mimeType.includes("png") ? "png" : "jpg" } : null;
    }),
  );
  const pdf = await renderReportPdf({ productName: data.audit.productName, productUrl: data.audit.productUrl, report: data.report, images });
  const name = data.audit.productName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="ux-audit-${name}.pdf"` },
  });
}
