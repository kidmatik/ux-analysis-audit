import { prisma } from "../prisma";
import { decryptJson, randomToken } from "../crypto";
import { finalizeReport } from "../report";
import { captureAvailable, captureDemoAccount, captureLiveUrl } from "./capture";
import { captureFigma } from "./figma";
import { claudeEnabled, claudeReport } from "./claude";
import { heuristicReport, type AuditContext } from "./heuristic";
import { auditVisibility, visibilitySummary } from "./visibility";
import type { PageSignals, Screen } from "./types";

export type AccessDetails = {
  loginUrl?: string;
  email?: string;
  mfaNotes?: string;
  reviewerNotes?: string;
  loomUrl?: string;
  figmaUrl?: string;
};

export type Secrets = { password?: string; figmaToken?: string };

const STAGE_MIN_MS = Number(process.env.STAGE_MIN_MS ?? 1200);

async function setStage(id: string, stage: number) {
  await prisma.audit.update({ where: { id }, data: { stage, status: "processing" } });
}

// Ensures each stage is visible on the processing screen for at least a moment.
async function timed<T>(id: string, stage: number, fn: () => Promise<T>): Promise<T> {
  await setStage(id, stage);
  const t0 = Date.now();
  const out = await fn();
  const wait = STAGE_MIN_MS - (Date.now() - t0);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  return out;
}

export async function purgeSecrets(id: string) {
  await prisma.audit.update({
    where: { id },
    data: { encryptedSecret: null, secretsPurgedAt: new Date() },
  });
  // Also drop the demo email; it is not needed once screens are captured.
  const audit = await prisma.audit.findUnique({ where: { id } });
  if (audit) {
    const details = JSON.parse(audit.accessDetails) as AccessDetails;
    if (details.email) {
      delete details.email;
      await prisma.audit.update({ where: { id }, data: { accessDetails: JSON.stringify(details) } });
    }
  }
}

async function existingScreens(auditId: string): Promise<Screen[]> {
  const assets = await prisma.asset.findMany({ where: { auditId, kind: "screenshot" }, orderBy: { order: "asc" } });
  return assets.map((a) => ({
    assetId: a.id,
    label: a.label,
    width: a.width ?? 1440,
    height: a.height ?? 900,
    path: a.path,
    mimeType: a.mimeType,
    elements: [],
  }));
}

function visibilityTarget(accessMethod: string, productUrl: string | null | undefined) {
  if (!productUrl || (accessMethod !== "url" && accessMethod !== "demo")) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(productUrl) ? productUrl : `https://${productUrl}`);
    // Demo accounts point at the app; audit the public site at its origin instead.
    return accessMethod === "demo" ? `${u.origin}/` : u.toString();
  } catch {
    return null;
  }
}

export async function runAudit(id: string) {
  const audit = await prisma.audit.findUnique({ where: { id } });
  if (!audit || audit.status === "complete") return;
  const details = JSON.parse(audit.accessDetails) as AccessDetails;
  const ctx: AuditContext = {
    productName: audit.productName,
    productUrl: audit.productUrl,
    productType: audit.productType,
    growthStage: audit.growthStage,
    primaryGoal: audit.primaryGoal,
    focusAreas: JSON.parse(audit.focusAreas),
    accessMethod: audit.accessMethod,
  };
  const notes: string[] = [];
  if (details.reviewerNotes) notes.push(details.reviewerNotes);
  if (details.mfaNotes) notes.push(`MFA: ${details.mfaNotes}`);
  if (details.loomUrl) notes.push(`Walkthrough video: ${details.loomUrl}`);

  // AI & search visibility runs over plain HTTP alongside capture. It only ever reads the
  // public URL (never with demo credentials) and its failure never fails the audit.
  const publicUrl = visibilityTarget(audit.accessMethod, audit.productUrl);
  const visibilityRun = publicUrl
    ? auditVisibility(publicUrl).catch((e) => {
        console.error("[audit] visibility audit failed", (e as Error).message);
        notes.push(`AI & search visibility could not be audited: ${(e as Error).message}`);
        return null;
      })
    : Promise.resolve(null);

  try {
    const secrets: Secrets = audit.encryptedSecret ? decryptJson<Secrets>(audit.encryptedSecret) : {};

    // Stage 0: capture screens
    const { screens, signals } = await timed(id, 0, async () => {
      let screens: Screen[] = await existingScreens(id);
      let signals: PageSignals[] = [];
      try {
        if (audit.accessMethod === "url" && audit.productUrl) {
          const r = await captureLiveUrl(id, audit.productUrl);
          screens = [...screens, ...r.screens];
          signals = r.signals;
          notes.push(...r.notes);
        } else if (audit.accessMethod === "demo" && details.loginUrl && details.email && secrets.password) {
          const r = await captureDemoAccount(id, { loginUrl: details.loginUrl, productUrl: audit.productUrl, email: details.email, password: secrets.password });
          screens = [...screens, ...r.screens];
          signals = r.signals;
          notes.push(...r.notes);
        } else if (audit.accessMethod === "figma" && details.figmaUrl) {
          const token = secrets.figmaToken || process.env.FIGMA_TOKEN;
          if (!token) throw new Error("A Figma access token is required to read the file.");
          const r = await captureFigma(id, details.figmaUrl, token);
          screens = [...screens, ...r.screens];
        } else if (!screens.length && audit.productUrl && captureAvailable()) {
          // Upload or recording without images: fall back to the public URL.
          const r = await captureLiveUrl(id, audit.productUrl);
          screens = r.screens;
          signals = r.signals;
        }
      } catch (e) {
        const msg = (e as Error).message;
        console.error("[audit] capture failed", msg);
        notes.push(
          `Capture issue: ${
            /net::|Timeout|ERR_/.test(msg)
              ? `We could not load ${audit.productUrl || "the page"}. Check that it is public and reachable, then retry.`
              : msg.split("\n")[0]
          }`,
        );
        if (!screens.length && audit.productUrl && audit.accessMethod !== "url" && captureAvailable()) {
          const r = await captureLiveUrl(id, audit.productUrl).catch(() => null);
          if (r) {
            screens = r.screens;
            signals = r.signals;
          }
        }
      }
      return { screens, signals };
    });

    // Credentials are only needed for capture. Delete them now, before analysis.
    if (audit.encryptedSecret) await purgeSecrets(id);
    if (!screens.length && !signals.length) {
      throw new Error(notes.find((n) => n.startsWith("Capture issue"))?.replace("Capture issue: ", "") ?? "No screens could be captured or uploaded for analysis.");
    }

    await timed(id, 1, async () => {});
    await timed(id, 2, async () => {});

    const visibility = await visibilityRun;
    if (visibility) notes.push(visibilitySummary(visibility));

    // Stage 3: analysis
    const { core, engine } = await timed(id, 3, async () => {
      if (claudeEnabled()) {
        try {
          return { core: await claudeReport(ctx, screens.slice(0, 12), signals, notes), engine: "claude" as const };
        } catch (e) {
          console.error("[audit] Claude analysis failed, using heuristic engine:", e);
        }
      }
      return { core: heuristicReport(ctx, screens, signals), engine: "heuristic" as const };
    });

    // Stage 4: action plan and report assembly
    const report = await timed(id, 4, async () => ({ ...finalizeReport(core, screens, engine), visibility }));
    await prisma.audit.update({
      where: { id },
      data: {
        status: "complete",
        stage: 5,
        report: JSON.stringify(report),
        growthScore: report.growthScore,
        engine,
        completedAt: new Date(),
        shareToken: audit.shareToken ?? randomToken(),
      },
    });
  } catch (e) {
    console.error("[audit] failed", e);
    await prisma.audit.update({ where: { id }, data: { status: "failed", error: (e as Error).message.slice(0, 500) } });
    if (audit.encryptedSecret) await purgeSecrets(id).catch(() => {});
  }
}
