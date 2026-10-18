import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStripeSignature } from "@/lib/billing";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 404 });
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const event = JSON.parse(payload);
  const obj = event.data?.object ?? {};
  if (event.type === "checkout.session.completed" && obj.client_reference_id) {
    await prisma.user.update({
      where: { id: obj.client_reference_id },
      data: { plan: "pro", planSince: new Date(), stripeCustomerId: obj.customer ?? undefined },
    });
  }
  if (event.type === "customer.subscription.deleted" && obj.customer) {
    await prisma.user.updateMany({ where: { stripeCustomerId: obj.customer }, data: { plan: "free" } });
  }
  return NextResponse.json({ received: true });
}
