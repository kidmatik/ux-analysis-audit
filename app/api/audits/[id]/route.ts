import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STALE_MS = 6 * 60 * 1000;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const audit = await prisma.audit.findFirst({ where: { id, userId: user.id } });
  if (!audit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // A run interrupted by a server restart never finishes; surface it so the user can retry.
  if ((audit.status === "processing" || audit.status === "queued") && Date.now() - audit.startedAt.getTime() > STALE_MS) {
    await prisma.audit.update({ where: { id }, data: { status: "failed", error: "The analysis was interrupted. Retry to run it again." } });
    return NextResponse.json({ status: "failed", stage: audit.stage, error: "The analysis was interrupted. Retry to run it again." });
  }
  return NextResponse.json({ status: audit.status, stage: audit.stage, error: audit.error });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.audit.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
