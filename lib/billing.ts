import crypto from "node:crypto";

export const stripeEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);

// Without Stripe configured, upgrades are simulated so the Pro flow can be tested locally.
// In production this is off unless ALLOW_DEMO_UPGRADE=true.
export const demoUpgradeAllowed = () =>
  !stripeEnabled() && (process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_UPGRADE === "true");

export async function stripe(path: string, body: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe error ${res.status}`);
  return json;
}

export function verifyStripeSignature(payload: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${payload}`).digest("hex");
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
  return fresh && sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}
