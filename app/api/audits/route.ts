import { NextResponse, after } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptJson } from "@/lib/crypto";
import { extFromMime, imageSize, saveFile } from "@/lib/storage";
import { runAudit, type AccessDetails, type Secrets } from "@/lib/engine/pipeline";
import { FREE_SCAN_LIMIT } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 300;

const optionalUrl = z.union([z.literal(""), z.string().trim().url()]).optional();

const Payload = z.object({
  productName: z.string().trim().min(1).max(120),
  productUrl: optionalUrl,
  productType: z.string().min(1),
  growthStage: z.string().min(1),
  primaryGoal: z.string().min(1),
  accessMethod: z.enum(["url", "demo", "figma", "recording", "upload"]),
  focusAreas: z.array(z.string()).max(10),
  demo: z.object({ loginUrl: optionalUrl, email: z.string().optional(), password: z.string().optional(), mfaNotes: z.string().max(1000).optional(), reviewerNotes: z.string().max(2000).optional() }).optional(),
  figma: z.object({ url: optionalUrl, token: z.string().optional() }).optional(),
  loomUrl: optionalUrl,
  notes: z.string().max(2000).optional(),
});

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGE = 12 * 1024 * 1024;
const MAX_VIDEO = 200 * 1024 * 1024;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to start an audit." }, { status: 401 });

  if (user.plan !== "pro") {
    const count = await prisma.audit.count({ where: { userId: user.id } });
    if (count >= FREE_SCAN_LIMIT) {
      return NextResponse.json({ error: "Your free scan has been used. Upgrade to Pro for unlimited scans.", upgrade: true }, { status: 402 });
    }
  }

  const form = await req.formData();
  const parsed = Payload.safeParse(JSON.parse(String(form.get("payload") ?? "{}")));
  if (!parsed.success) return NextResponse.json({ error: "Some fields are missing or invalid.", issues: parsed.error.issues }, { status: 400 });
  const p = parsed.data;

  const images = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  const video = form.get("video");

  // Validate per access method.
  const fail = (error: string) => NextResponse.json({ error }, { status: 400 });
  if (p.accessMethod === "url" && !p.productUrl) return fail("Enter the live URL to scan.");
  if (p.accessMethod === "demo" && (!p.demo?.loginUrl || !p.demo.email || !p.demo.password)) return fail("Login URL, email and password are required for demo access.");
  if (p.accessMethod === "figma" && !p.figma?.url) return fail("Paste a Figma file link.");
  if (p.accessMethod === "figma" && !p.figma?.token && !process.env.FIGMA_TOKEN) return fail("Add a Figma personal access token so we can read the file.");
  if ((p.accessMethod === "upload" || p.accessMethod === "recording") && !images.length && !p.loomUrl && !p.productUrl) {
    return fail("Add at least one screenshot, a video, or a Loom link.");
  }
  for (const f of images) {
    if (!IMAGE_TYPES.includes(f.type)) return fail(`${f.name} is not a supported image (PNG, JPG, WebP or GIF).`);
    if (f.size > MAX_IMAGE) return fail(`${f.name} is larger than 12 MB.`);
  }
  if (video instanceof File && video.size > MAX_VIDEO) return fail("Video must be under 200 MB.");

  const details: AccessDetails = {
    loginUrl: p.demo?.loginUrl || undefined,
    email: p.demo?.email || undefined,
    mfaNotes: p.demo?.mfaNotes || undefined,
    reviewerNotes: p.demo?.reviewerNotes || p.notes || undefined,
    loomUrl: p.loomUrl || undefined,
    figmaUrl: p.figma?.url || undefined,
  };
  const secrets: Secrets = { password: p.demo?.password || undefined, figmaToken: p.figma?.token || undefined };
  const hasSecrets = Boolean(secrets.password || secrets.figmaToken);

  const audit = await prisma.audit.create({
    data: {
      userId: user.id,
      productName: p.productName,
      productUrl: p.productUrl || details.loginUrl || "",
      productType: p.productType,
      growthStage: p.growthStage,
      primaryGoal: p.primaryGoal,
      accessMethod: p.accessMethod,
      accessDetails: JSON.stringify(details),
      encryptedSecret: hasSecrets ? encryptJson(secrets) : null,
      focusAreas: JSON.stringify(p.focusAreas),
    },
  });

  let order = 0;
  const source = p.accessMethod === "recording" ? "recording" : "upload";
  for (const f of images) {
    const buf = Buffer.from(await f.arrayBuffer());
    const size = imageSize(buf);
    const rel = await saveFile(audit.id, extFromMime(f.type), buf);
    const name = f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").slice(0, 60);
    const label = source === "recording" ? `Recording: frame ${order + 1}` : /^frame \d+$/i.test(name) ? `Upload: video ${name}` : `Upload: ${name}`;
    await prisma.asset.create({
      data: { auditId: audit.id, kind: "screenshot", label, source, path: rel, mimeType: f.type, width: size?.width, height: size?.height, order: order++ },
    });
  }
  if (video instanceof File && video.size > 0) {
    const rel = await saveFile(audit.id, extFromMime(video.type), Buffer.from(await video.arrayBuffer()));
    await prisma.asset.create({ data: { auditId: audit.id, kind: "video", label: "Walkthrough video", source, path: rel, mimeType: video.type || "video/webm" } });
  }

  after(() => runAudit(audit.id));
  return NextResponse.json({ id: audit.id });
}
