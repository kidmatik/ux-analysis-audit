import { NextResponse, after } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runAudit } from "@/lib/engine/pipeline";

export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const audit = await prisma.audit.findFirst({ where: { id, userId: user.id } });
  if (!audit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (audit.status !== "failed") return NextResponse.json({ ok: true });
  // Remove captured screens from the failed run; uploads are kept.
  await prisma.asset.deleteMany({ where: { auditId: id, source: { in: ["capture", "figma"] } } });
  await prisma.audit.update({ where: { id }, data: { status: "queued", stage: 0, error: null, startedAt: new Date() } });
  after(() => runAudit(id));
  return NextResponse.json({ ok: true });
}
