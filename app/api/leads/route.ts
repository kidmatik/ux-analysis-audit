import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  email: z.string().trim().email(),
  kind: z.enum(["human_audit", "strategy_call"]),
  message: z.string().max(2000).optional(),
  auditId: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  const { auditId, ...data } = parsed.data;
  const audit = auditId ? await prisma.audit.findUnique({ where: { id: auditId } }) : null;
  await prisma.lead.create({ data: { ...data, auditId: audit?.id } });
  return NextResponse.json({ ok: true });
}
