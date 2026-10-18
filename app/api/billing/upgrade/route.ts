import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { demoUpgradeAllowed, stripe, stripeEnabled } from "@/lib/billing";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const origin = new URL(req.url).origin;
  const { returnTo } = (await req.json().catch(() => ({}))) as { returnTo?: string };
  const back = returnTo && returnTo.startsWith("/") ? returnTo : "/dashboard";

  if (stripeEnabled()) {
    const session = await stripe("/checkout/sessions", {
      mode: "subscription",
      "line_items[0][price]": process.env.STRIPE_PRICE_ID!,
      "line_items[0][quantity]": "1",
      client_reference_id: user.id,
      customer_email: user.email,
      success_url: `${origin}${back}${back.includes("?") ? "&" : "?"}upgraded=1`,
      cancel_url: `${origin}${back}`,
    });
    return NextResponse.json({ url: session.url });
  }
  if (demoUpgradeAllowed()) {
    await prisma.user.update({ where: { id: user.id }, data: { plan: "pro", planSince: new Date() } });
    return NextResponse.json({ url: `${back}${back.includes("?") ? "&" : "?"}upgraded=1`, demo: true });
  }
  return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
}
