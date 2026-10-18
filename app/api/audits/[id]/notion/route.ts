import { NextResponse } from "next/server";
import { loadAuditForView } from "@/lib/access";
import { reportToMarkdown } from "@/lib/markdown";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadAuditForView({ id });
  if (!data?.report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (data.report.locked) return NextResponse.json({ error: "Notion export is part of Pro." }, { status: 402 });
  const origin = new URL(req.url).origin;
  const md = reportToMarkdown(data.audit.productName, data.report, data.audit.shareToken ? `${origin}/r/${data.audit.shareToken}` : undefined);
  const name = data.audit.productName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="ux-audit-${name}.md"`,
    },
  });
}
