import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { demoUpgradeAllowed } from "@/lib/billing";

// Test helper for demo billing mode only. With Stripe, cancellation happens in the Stripe portal.
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!demoUpgradeAllowed()) return NextResponse.json({ error: "Not available" }, { status: 404 });
  await prisma.user.update({ where: { id: user.id }, data: { plan: "free" } });
  return NextResponse.json({ ok: true });
}
