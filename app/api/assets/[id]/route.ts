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
  const headers: Record<string, string> = { "Content-Type": asset.mimeType, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" };
  if (asset.mimeType === "text/html") {
    // Redesigned copies of third-party pages: no scripts, opaque origin, never same-origin with the app.
    headers["Content-Security-Policy"] = "sandbox allow-popups allow-popups-to-escape-sandbox; script-src 'none'; object-src 'none'";
    headers["Content-Type"] = "text/html; charset=utf-8";
    if (new URL(req.url).searchParams.has("download")) headers["Content-Disposition"] = `attachment; filename="redesigned-page.html"`;
  }
  return new NextResponse(new Uint8Array(data), { headers });
}
