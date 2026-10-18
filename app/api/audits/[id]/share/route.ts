import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomToken } from "@/lib/crypto";

// POST returns the share link (creating a token if needed). DELETE revokes it.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  const audit = user && (await prisma.audit.findFirst({ where: { id, userId: user.id } }));
  if (!audit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const token = audit.shareToken ?? randomToken();
  if (!audit.shareToken) await prisma.audit.update({ where: { id }, data: { shareToken: token } });
  return NextResponse.json({ url: `${new URL(req.url).origin}/r/${token}` });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.audit.updateMany({ where: { id, userId: user.id }, data: { shareToken: null } });
  return NextResponse.json({ ok: true });
}
