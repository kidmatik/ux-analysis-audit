import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Page } from "playwright-core";
import { labelFor, PRIMARY_GOALS, PRODUCT_TYPES } from "../config";
import { prisma } from "../prisma";
import type { Report } from "../report";
import { heuristicPlan, RedesignPlanSchema, type CurrentStyle, type Pin, type RedesignPlan, type RedesignRecord } from "../redesign";
import { readStored, saveFile } from "../storage";
import { captureAvailable, collectInPage, launch, settle } from "./capture";
import { claudeEnabled } from "./claude";
import type { PageSignals } from "./types";

const VIEWPORT = { width: 1440, height: 900 };
// Before and after are cropped to the same height so the slider lines up.
const MAX_SHOT_HEIGHT = 2000;

// ---- In-page functions (serialized into the browser; keep them self-contained) ----

export function readCurrentStyle(): CurrentStyle {
  const px = (v: string) => parseFloat(v) || 0;
  const family = (v: string) => v.split(",")[0].replace(/["']/g, "").trim();
  const clean = (s: string | null | undefined) => (s || "").replace(/\s+/g, " ").trim();
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 4 && r.height > 4 && st.visibility !== "hidden" && st.display !== "none";
  };
  const h1 = Array.from(document.querySelectorAll("h1")).find(visible) as HTMLElement | undefined;
  const h1s = h1 ? getComputedStyle(h1) : null;
  const bs = getComputedStyle(document.body);
  let bodyBg = bs.backgroundColor;
  if (/rgba\(0, 0, 0, 0\)|transparent/.test(bodyBg)) bodyBg = getComputedStyle(document.documentElement).backgroundColor;
  // The hero paragraph: the first substantial paragraph after the headline.
  let heroParagraph = "";
  if (h1) {
    const ps = Array.from(document.querySelectorAll("p")).filter(
      (p) => visible(p) && h1.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING && clean(p.textContent).length > 40,
    );
    heroParagraph = clean(ps[0]?.textContent);
  }
  const buttons = Array.from(document.querySelectorAll("button, a, input[type=submit]"))
    .filter((el) => {
      if (!visible(el)) return false;
      const bg = getComputedStyle(el).backgroundColor;
      return bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg) && el.getBoundingClientRect().top + window.scrollY < window.innerHeight * 1.2;
    })
    .slice(0, 8)
    .map((el) => {
      const st = getComputedStyle(el);
      return { text: clean((el as HTMLElement).innerText || (el as HTMLInputElement).value).slice(0, 40), background: st.backgroundColor, color: st.color, radius: px(st.borderTopLeftRadius) };
    });
  return {
    headingFont: family(h1s?.fontFamily ?? bs.fontFamily),
    bodyFont: family(bs.fontFamily),
    h1: h1s ? { size: px(h1s.fontSize), weight: Number(h1s.fontWeight) || 700, lineHeight: px(h1s.lineHeight) / (px(h1s.fontSize) || 1) || 1.2, color: h1s.color } : null,
    body: { size: px(bs.fontSize), lineHeight: px(bs.lineHeight) / (px(bs.fontSize) || 1) || 1.5, color: bs.color, background: bodyBg },
    buttons,
    heroParagraph,
    headings: Array.from(document.querySelectorAll("h2, h3")).filter(visible).slice(0, 12).map((h) => clean(h.textContent)),
  };
}

export type RawPin = { copyIndex: number; left: number; top: number; width: number; height: number };

// Applies the plan to the live DOM: fonts, type scale, palette, CTA consolidation and copy.
// Returns where each rewritten element ends up (page px), for the numbered pins on the after image.
export async function applyPlan(plan: RedesignPlan): Promise<RawPin[]> {
  const sg = plan.styleguide;
  const color = (role: string, fb: string) => sg.colors.find((c) => c.role === role)?.hex ?? fb;
  const tok = (t: string) => sg.type.find((x) => x.token === t);
  const norm = (s: string | null | undefined) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && st.visibility !== "hidden" && st.display !== "none";
  };
  const set = (el: HTMLElement, props: Record<string, string>) => {
    for (const [k, v] of Object.entries(props)) el.style.setProperty(k, v, "important");
  };
  const primary = color("primary", "#4f46e5");
  const onPrimary = color("on_primary", "#ffffff");
  const ink = color("ink", "#111827");
  const muted = color("muted", "#4b5563");

  // Fonts
  const fams = Array.from(new Set([sg.fonts.heading, sg.fonts.body]));
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800`).join("&")}&display=swap`;
  document.head.appendChild(link);
  await new Promise<void>((resolve) => {
    link.onload = () => resolve();
    link.onerror = () => resolve();
    setTimeout(resolve, 4000);
  });
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);

  const t = (name: string, sel: string, extra = "") => {
    const x = tok(name);
    return x ? `${sel}{font-size:min(${x.size}px, ${(x.size / 14.4).toFixed(2)}vw + 16px) !important;font-weight:${x.weight} !important;line-height:${x.lineHeight} !important;letter-spacing:${x.tracking}em !important;${extra}}` : "";
  };
  // Headings set in light text (on dark bands or images) keep their color.
  const lum = (c: string) => {
    const m = c.match(/[\d.]+/g);
    return m ? (0.2126 * Number(m[0]) + 0.7152 * Number(m[1]) + 0.0722 * Number(m[2])) / 255 : 0;
  };
  const lightHeads = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3"))
    .map((el) => ({ el, color: getComputedStyle(el).color }))
    .filter((h) => lum(h.color) > 0.6);
  const style = document.createElement("style");
  style.id = "uxa-redesign";
  style.textContent = [
    `:root{--uxa-primary:${primary};--uxa-ink:${ink};--uxa-muted:${muted};--uxa-radius:${sg.radius}px}`,
    `body{font-family:"${sg.fonts.body}",ui-sans-serif,system-ui,sans-serif !important;color:${ink}}`,
    `h1,h2,h3{font-family:"${sg.fonts.heading}",ui-sans-serif,system-ui,sans-serif !important;color:${ink} !important;text-wrap:balance}`,
    t("display", "h1", "max-width:15ch;"),
    t("h2", "h2"),
    t("h3", "h3"),
  ].join("\n");
  document.head.appendChild(style);
  for (const h of lightHeads) set(h.el, { color: h.color });

  const changed: { el: HTMLElement; copyIndex: number }[] = [];
  const candidates = () => Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,p,a,button,span,li,label,div,input[type=submit]")).filter(visible);
  const textOf = (el: HTMLElement) => norm(el instanceof HTMLInputElement ? el.value : el.innerText);
  // Smallest visible element whose text matches; long text may match by prefix.
  const findText = (text: string, all = false) => {
    const target = norm(text);
    if (!target) return [];
    const prefix = target.length > 60 ? target.slice(0, 60) : null;
    const hits = candidates().filter((el) => {
      const s = textOf(el);
      return s === target || (prefix !== null && s.startsWith(prefix) && s.length < target.length * 1.3);
    });
    const leaves = hits.filter((el) => !hits.some((o) => o !== el && el.contains(o)));
    return all ? leaves : leaves.slice(0, 1);
  };
  const isButtonish = (el: HTMLElement) => /^(A|BUTTON|INPUT)$/.test(el.tagName) || !!el.closest("a,button");
  const asButton = (el: HTMLElement) => (el.closest("a,button") as HTMLElement | null) ?? el;
  const heroLimit = window.innerHeight * 1.3;
  const inHero = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY < heroLimit;

  // Calls to action: one filled primary everywhere it appears, a quiet secondary link, and no competing hero buttons.
  const btnSize = tok("button")?.size ?? 17;
  if (plan.ctas.primary) {
    for (const el of findText(plan.ctas.primary, true).filter(isButtonish).map(asButton)) {
      set(el, {
        background: primary, "background-image": "none", color: onPrimary, "border-radius": `${sg.radius}px`, border: "0",
        padding: inHero(el) && el.getBoundingClientRect().top + window.scrollY > 120 ? "18px 30px" : "11px 20px",
        "font-size": inHero(el) && el.getBoundingClientRect().top + window.scrollY > 120 ? `${btnSize}px` : "15px",
        "font-weight": String(tok("button")?.weight ?? 700), "box-shadow": `0 10px 24px -8px ${primary}99`, "text-decoration": "none",
      });
    }
  }
  if (plan.ctas.secondary) {
    for (const el of findText(plan.ctas.secondary, true).filter(isButtonish).map(asButton).filter(inHero)) {
      set(el, { background: "transparent", "background-image": "none", color: ink, border: "0", "box-shadow": "none", padding: "18px 8px", "font-size": `${btnSize - 1}px`, "font-weight": "600", "text-decoration": "underline", "text-underline-offset": "5px", "text-decoration-thickness": "2px" });
    }
  }
  for (const text of plan.ctas.remove) {
    for (const el of findText(text, true).filter(isButtonish).map(asButton).filter(inHero)) set(el, { display: "none" });
  }

  // Copy rewrites.
  plan.copy.forEach((c, copyIndex) => {
    const all = c.role === "primary_cta" || c.role === "secondary_cta" || c.role === "form_button";
    for (const el of findText(c.before, all)) {
      if (el instanceof HTMLInputElement) el.value = c.after;
      else {
        // Keep icons: replace the main text node when there is one, else the whole text.
        const nodes: Text[] = [];
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) if ((walker.currentNode.nodeValue || "").trim()) nodes.push(walker.currentNode as Text);
        const main = nodes.sort((a, b) => (b.nodeValue || "").length - (a.nodeValue || "").length)[0];
        if (main && norm(main.nodeValue).length >= norm(el.innerText).length * 0.8) main.nodeValue = c.after;
        else el.textContent = c.after;
      }
      if (c.role === "subheadline") {
        const x = tok("body_lg");
        set(el, { color: muted, "max-width": "34em", ...(x ? { "font-size": `${x.size}px`, "line-height": String(x.lineHeight) } : {}) });
      }
      changed.push({ el: isButtonish(el) ? asButton(el) : el, copyIndex });
    }
  });

  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 300));
  const seen = new Set<number>();
  const pins: RawPin[] = [];
  // Where a rewrite appears more than once (a header and a hero button), pin the largest.
  const area = (el: HTMLElement) => el.getBoundingClientRect().width * el.getBoundingClientRect().height;
  for (const { el, copyIndex } of [...changed].sort((a, b) => area(b.el) - area(a.el))) {
    if (seen.has(copyIndex)) continue;
    const r = el.getBoundingClientRect();
    const top = r.top + window.scrollY;
    if (r.width < 2) continue;
    seen.add(copyIndex);
    pins.push({ copyIndex, left: r.left, top, width: r.width, height: r.height });
  }
  return pins.sort((a, b) => a.copyIndex - b.copyIndex);
}

export function toPins(raw: RawPin[], width: number, height: number): Pin[] {
  return raw
    .filter((p) => p.top < height - 10)
    .map((p) => ({ copyIndex: p.copyIndex, x: (p.left / width) * 100, y: (p.top / height) * 100, w: (p.width / width) * 100, h: (Math.min(p.height, height - p.top) / height) * 100 }));
}

export const pageHeight = () => document.documentElement.scrollHeight;

// Strips scripts so the snapshot keeps the redesigned DOM, and resolves relative URLs.
export function snapshotHtml(origin: string) {
  const doc = document.documentElement.cloneNode(true) as HTMLElement;
  doc.querySelectorAll("script, noscript, iframe").forEach((n) => n.remove());
  doc.querySelectorAll("*").forEach((n) => {
    for (const a of Array.from(n.attributes)) if (/^on/i.test(a.name)) n.removeAttribute(a.name);
  });
  const head = doc.querySelector("head");
  if (head) {
    const base = document.createElement("base");
    base.href = origin;
    head.prepend(base);
  }
  return `<!doctype html>\n<!-- Redesigned copy generated by UX Analysis Audit (powered by Matan.Design). Scripts are removed. -->\n${doc.outerHTML}`;
}

// ---- Plan generation ----

const SYSTEM = `You are a senior product designer and conversion copywriter. You receive an executive UX audit of a page, a screenshot of the page and its captured copy and styles.
Produce a redesign plan that applies the audit's fixes to this exact page: rewritten copy, a consolidated call-to-action hierarchy and a new styleguide.

Copy rules:
- "before" must be the exact current text as it appears in the captured page data, so it can be found and replaced on the page.
- Always rewrite the main headline to lead with the buyer's outcome in under ten words. Rewrite the hero subheadline to one sentence that says how. Rename generic buttons (Submit, Get started, Learn more) to verb plus object.
- Rewrite generic section headings into benefit statements where the audit calls for it.
- Never invent statistics, customer names, logos, ratings or testimonials. Where proof is needed, write a bracketed placeholder such as [customer count].
- Write in the page's language and the product's register: specific, confident, no hype words.

CTA hierarchy: keep exactly one primary hero action and at most one secondary; list the rest in "remove" using their exact current text.

Styleguide: build on the brand's existing primary color, but fix contrast (white text on primary at least 4.5:1, ink on background at least 12:1, muted at least 6:1). Choose Google Fonts that suit the product. The display size should make the headline the dominant element (typically 52-68px, weight 700-800). Provide one entry for every color role and type token.

List every change in "changes", tied to finding ids where they address a finding. Estimate projectedScore conservatively from the findings addressed.`;

async function claudePlan(audit: { productName: string; productType: string; primaryGoal: string }, report: Report, page: PageSignals | null, current: CurrentStyle | null, shot: Buffer | null): Promise<RedesignPlan> {
  const client = new Anthropic();
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (shot) content.push({ type: "image", source: { type: "base64", media_type: "image/png", data: shot.toString("base64") } });
  const findings = report.findings
    .map((f) => `${f.id} [${f.severity}, ${f.category}] ${f.title}\n  Problem: ${f.problem}\n  Fix: ${f.recommendedFix}`)
    .join("\n");
  content.push({
    type: "text",
    text: `Product: ${audit.productName}
Type: ${labelFor(PRODUCT_TYPES, audit.productType)}
Primary goal: ${labelFor(PRIMARY_GOALS, audit.primaryGoal)}
Current UX growth score: ${report.growthScore}/100

Audit summary: ${report.executiveSummary}

Findings:
${findings}

Captured page copy:
  H1: ${page?.h1.join(" | ") || "(none)"}
  Hero paragraph: ${current?.heroParagraph || "(none)"}
  Section headings: ${(page?.headings ?? current?.headings ?? []).join(" | ")}
  Buttons and CTAs: ${page?.ctas.join(" | ") || "(none)"}
  CTAs above the fold: ${page?.aboveFoldCtas.join(" | ") || "(none)"}
  Meta description: ${page?.metaDescription || "(none)"}

Current styles: ${current ? JSON.stringify(current) : "(not captured)"}

Produce the redesign plan.`,
  });
  const response = await client.beta.messages.parse({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
    max_tokens: 12000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: betaZodOutputFormat(RedesignPlanSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  if (!response.parsed_output) throw new Error(`No structured output (stop reason: ${response.stop_reason})`);
  return response.parsed_output;
}

// ---- Pipeline ----

async function save(id: string, patch: Partial<RedesignRecord>) {
  const audit = await prisma.audit.findUnique({ where: { id }, select: { redesign: true } });
  const prev = audit?.redesign ? (JSON.parse(audit.redesign) as RedesignRecord) : ({} as RedesignRecord);
  await prisma.audit.update({ where: { id }, data: { redesign: JSON.stringify({ ...prev, ...patch }) } });
}

async function saveShot(auditId: string, page: Page, height: number, label: string) {
  const buf = await page.screenshot({ type: "png", fullPage: true, clip: { x: 0, y: 0, width: VIEWPORT.width, height } });
  const rel = await saveFile(auditId, "png", buf);
  const asset = await prisma.asset.create({ data: { auditId, kind: "redesign", label, source: "redesign", path: rel, mimeType: "image/png", width: VIEWPORT.width, height } });
  return { buf, shot: { assetId: asset.id, width: VIEWPORT.width, height } };
}

async function firstScreenshot(report: Report) {
  const first = report.screenshots[0];
  const asset = first ? await prisma.asset.findUnique({ where: { id: first.assetId } }) : null;
  return asset && asset.mimeType === "image/png" ? readStored(asset.path).catch(() => null) : null;
}

function targetUrl(productUrl: string, accessMethod: string) {
  if (!productUrl || (accessMethod !== "url" && accessMethod !== "demo")) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(productUrl) ? productUrl : `https://${productUrl}`);
    return accessMethod === "demo" ? `${u.origin}/` : u.toString();
  } catch {
    return null;
  }
}

export async function runRedesign(id: string) {
  const audit = await prisma.audit.findUnique({ where: { id } });
  if (!audit?.report) return;
  const report = JSON.parse(audit.report) as Report;
  const notes: string[] = [];
  const url = targetUrl(audit.productUrl, audit.accessMethod);
  const browser = url && captureAvailable() ? await launch().catch(() => null) : null;
  try {
    // Remove assets from an earlier redesign of this audit.
    await prisma.asset.deleteMany({ where: { auditId: id, kind: { in: ["redesign", "redesign_html"] } } });
    let page: Page | null = null;
    let signals: PageSignals | null = null;
    let current: CurrentStyle | null = null;
    let before: { buf: Buffer; shot: RedesignRecord["before"] } | null = null;
    let shotHeight = 0;

    await save(id, { stage: 0 });
    if (browser && url) {
      try {
        const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
        page = await ctx.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await settle(page);
        const { signals: s } = await page.evaluate(collectInPage);
        signals = { ...s, url: page.url(), loadMs: 0 } as PageSignals;
        current = await page.evaluate(readCurrentStyle);
        shotHeight = Math.min(MAX_SHOT_HEIGHT, await page.evaluate(() => document.documentElement.scrollHeight));
        await page.evaluate(() => window.scrollTo(0, 0));
        before = await saveShot(id, page, shotHeight, "Before redesign");
      } catch (e) {
        notes.push(`We could not load the live page for the visual preview (${(e as Error).message.split("\n")[0]}). Copy and styleguide are based on the audit.`);
        page = null;
      }
    } else {
      notes.push(url ? "Live capture is not available on this server, so the redesign shows copy and styleguide without the visual preview." : "The visual preview needs a public URL. Copy and styleguide are based on the audit.");
    }

    await save(id, { stage: 1 });
    const findings = report.findings.map((f) => ({ id: f.id, title: f.title, category: f.category, severity: f.severity, impact: f.impact, recommendedFix: f.recommendedFix }));
    let plan: RedesignPlan | null = null;
    let engine: RedesignRecord["engine"] = "heuristic";
    if (claudeEnabled()) {
      try {
        plan = await claudePlan(audit, report, signals, current, before?.buf ?? (await firstScreenshot(report)));
        engine = "claude";
      } catch (e) {
        console.error("[redesign] Claude plan failed, using heuristic plan:", e);
      }
    }
    plan ??= heuristicPlan({ productName: audit.productName, primaryGoal: audit.primaryGoal, growthScore: report.growthScore, findings, page: signals, current });
    await save(id, { stage: 2 });

    let after: RedesignRecord["after"] = null;
    let htmlAssetId: string | null = null;
    let pins: Pin[] = [];
    if (page && before) {
      await save(id, { stage: 3 });
      const raw = await page.evaluate(applyPlan, plan);
      await save(id, { stage: 4 });
      // A shorter redesigned page would leave an empty strip: crop both images to the shorter height.
      const afterHeight = Math.min(MAX_SHOT_HEIGHT, await page.evaluate(pageHeight));
      if (afterHeight < shotHeight) {
        shotHeight = afterHeight;
        if (before.shot) await prisma.asset.delete({ where: { id: before.shot.assetId } }).catch(() => {});
        const fresh = await page.context().newPage();
        await fresh.goto(page.url(), { waitUntil: "domcontentloaded", timeout: 30000 });
        await settle(fresh);
        before = await saveShot(id, fresh, shotHeight, "Before redesign");
        await fresh.close();
      }
      pins = toPins(raw, VIEWPORT.width, shotHeight);
      after = (await saveShot(id, page, shotHeight, "After redesign")).shot;
      const html = await page.evaluate(snapshotHtml, new URL(page.url()).origin + "/");
      const rel = await saveFile(id, "html", Buffer.from(html, "utf8"));
      htmlAssetId = (await prisma.asset.create({ data: { auditId: id, kind: "redesign_html", label: "Redesigned page", source: "redesign", path: rel, mimeType: "text/html" } })).id;
    } else {
      // Without a live page the "before" is the audit's first screenshot.
      const first = report.screenshots[0];
      if (first) before = { buf: Buffer.alloc(0), shot: { assetId: first.assetId, width: first.width, height: first.height } };
    }

    await save(id, { status: "complete", stage: 5, engine, plan, current, before: before?.shot ?? null, after, htmlAssetId, pins, notes, generatedAt: new Date().toISOString() });
  } catch (e) {
    console.error("[redesign] failed", e);
    await save(id, { status: "failed", error: (e as Error).message.slice(0, 300) });
  } finally {
    await browser?.close().catch(() => {});
  }
}
