import { NextResponse, after } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runRedesign } from "@/lib/engine/redesign";
import { REDESIGN_STALE_MS, redesignView, type RedesignRecord } from "@/lib/redesign";

export const maxDuration = 300;

async function ownedAudit(id: string) {
  const user = await currentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const audit = await prisma.audit.findFirst({ where: { id, userId: user.id } });
  if (!audit) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { user, audit };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await ownedAudit(id);
  if (r.error) return r.error;
  if (r.user.plan !== "pro") return NextResponse.json({ error: "One-click Redesign is part of Pro." }, { status: 402 });
  return NextResponse.json(redesignView(r.audit.redesign));
}

// Starts a One-click Redesign. Pro only; runs in the background and is polled with GET.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await ownedAudit(id);
  if (r.error) return r.error;
  if (r.user.plan !== "pro") return NextResponse.json({ error: "One-click Redesign is part of Pro." }, { status: 402 });
  if (r.audit.status !== "complete" || !r.audit.report) return NextResponse.json({ error: "The audit has not finished yet." }, { status: 409 });
  const prev = r.audit.redesign ? (JSON.parse(r.audit.redesign) as RedesignRecord) : null;
  if (prev?.status === "processing" && Date.now() - new Date(prev.startedAt).getTime() < REDESIGN_STALE_MS) {
    return NextResponse.json(redesignView(r.audit.redesign));
  }
  const record: RedesignRecord = { status: "processing", stage: 0, startedAt: new Date().toISOString() };
  await prisma.audit.update({ where: { id }, data: { redesign: JSON.stringify(record) } });
  after(() => runRedesign(id));
  return NextResponse.json(redesignView(JSON.stringify(record)));
}
