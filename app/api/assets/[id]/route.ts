import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readStored } from "@/lib/storage";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("t");
  const asset = await prisma.asset.findUnique({ where: { id }, include: { audit: true } });
  if (!asset) return new NextResponse("Not found", { status: 404 });
  let allowed = token ? asset.audit.shareToken === token : false;
  if (!allowed) {
    const user = await currentUser();
    allowed = user?.id === asset.audit.userId;
  }
  if (!allowed) return new NextResponse("Not found", { status: 404 });
  const data = await readStored(asset.path);
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": asset.mimeType, "Cache-Control": "private, max-age=3600" },
  });
}
