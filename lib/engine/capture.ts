import fs from "node:fs";
import type { Browser, Page } from "playwright-core";
import { prisma } from "../prisma";
import { saveFile } from "../storage";
import type { CaptureResult, DetectedElement, PageSignals, Screen } from "./types";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const MAX_SCREENS = 9;

function chromiumPath() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
  ].filter(Boolean) as string[];
  return candidates.find((p) => fs.existsSync(p));
}

export function captureAvailable() {
  return Boolean(chromiumPath());
}

async function launch(): Promise<Browser> {
  const { chromium } = await import("playwright-core");
  const executablePath = chromiumPath();
  if (!executablePath) throw new Error("No Chromium binary found. Set CHROMIUM_PATH to enable live capture.");
  const proxy = process.env.CAPTURE_PROXY || process.env.HTTPS_PROXY;
  return chromium.launch({
    executablePath,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    ...(proxy ? { proxy: { server: proxy, bypass: "localhost,127.0.0.1" } } : {}),
  });
}

// Runs inside the page. Returns elements visible in the current viewport, as percentages.
function collectInPage(): { elements: DetectedElement[]; signals: Omit<PageSignals, "url" | "loadMs"> } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const out: DetectedElement[] = [];
  const clean = (s: string | null | undefined) => (s || "").replace(/\s+/g, " ").trim().slice(0, 140);
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 4 && r.height > 4 && st.visibility !== "hidden" && st.display !== "none" && Number(st.opacity) > 0.05;
  };
  const push = (el: Element, kind: DetectedElement["kind"], text?: string) => {
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return;
    const x = Math.max(0, r.left), y = Math.max(0, r.top);
    const w = Math.min(vw, r.right) - x, h = Math.min(vh, r.bottom) - y;
    if (w < 4 || h < 4) return;
    out.push({ kind, text: clean(text ?? (el as HTMLElement).innerText), x: (x / vw) * 100, y: (y / vh) * 100, w: (w / vw) * 100, h: (h / vh) * 100 });
  };

  const h1s = Array.from(document.querySelectorAll("h1")).filter(visible);
  h1s.forEach((el) => push(el, "headline"));
  Array.from(document.querySelectorAll("h2")).filter(visible).slice(0, 12).forEach((el) => push(el, "subheadline"));
  const ctaEls = Array.from(document.querySelectorAll("button, a, input[type=submit]")).filter((el) => {
    if (!visible(el)) return false;
    const st = getComputedStyle(el);
    const bg = st.backgroundColor;
    const filled = bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
    const text = clean((el as HTMLElement).innerText || (el as HTMLInputElement).value);
    const verb = /(start|get|try|book|sign|join|request|demo|free|buy|subscribe|contact|create|launch|continue|upgrade)/i.test(text);
    return text.length > 1 && text.length < 40 && (filled || el.tagName === "BUTTON") && (verb || filled);
  });
  ctaEls.slice(0, 20).forEach((el) => push(el, "cta", (el as HTMLElement).innerText || (el as HTMLInputElement).value));
  Array.from(document.querySelectorAll("nav, header")).filter(visible).slice(0, 2).forEach((el) => push(el, "nav", ""));
  Array.from(document.querySelectorAll("form")).filter(visible).slice(0, 4).forEach((el) => push(el, "form", ""));
  Array.from(document.querySelectorAll("[class*=testimonial i], [class*=review i], [class*=logo i], blockquote"))
    .filter(visible).slice(0, 4).forEach((el) => push(el, "social_proof"));
  Array.from(document.querySelectorAll("[class*=pricing i], [id*=pricing i]")).filter(visible).slice(0, 2).forEach((el) => push(el, "pricing", ""));
  Array.from(document.querySelectorAll("p")).filter(visible).slice(0, 30).forEach((el) => {
    if (clean((el as HTMLElement).innerText).length > 60) push(el, "text");
  });

  const bodyText = document.body?.innerText || "";
  const lower = bodyText.toLowerCase();
  const links = Array.from(document.querySelectorAll("a")).map((a) => clean(a.innerText).toLowerCase());
  const above = Array.from(document.querySelectorAll("p, h1, h2, h3, li, span")).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.top + window.scrollY < vh && el.children.length === 0 && visible(el);
  });
  const navItems = Array.from(document.querySelectorAll("nav a, header a")).filter(visible).map((a) => clean((a as HTMLElement).innerText)).filter((t) => t && t.length < 30);
  return {
    elements: out,
    signals: {
      title: document.title,
      metaDescription: clean(document.querySelector("meta[name=description]")?.getAttribute("content")),
      h1: h1s.map((h) => clean(h.innerText)),
      headings: Array.from(document.querySelectorAll("h2, h3")).slice(0, 20).map((h) => clean((h as HTMLElement).innerText)).filter(Boolean),
      ctas: Array.from(new Set(ctaEls.map((el) => clean((el as HTMLElement).innerText || (el as HTMLInputElement).value)))).slice(0, 15),
      aboveFoldCtas: Array.from(new Set(ctaEls.filter((el) => el.getBoundingClientRect().top + window.scrollY < vh).map((el) => clean((el as HTMLElement).innerText)))),
      navItems: Array.from(new Set(navItems)).slice(0, 20),
      wordCount: bodyText.split(/\s+/).filter(Boolean).length,
      aboveFoldWords: above.map((el) => (el as HTMLElement).innerText).join(" ").split(/\s+/).filter(Boolean).length,
      formFields: document.querySelectorAll("input:not([type=hidden]), select, textarea").length,
      hasPricingLink: links.some((l) => l.includes("pricing") || l.includes("plans")),
      hasTestimonials: /testimonial|what (our )?customers|loved by|case stud|reviews?\b/.test(lower) || !!document.querySelector("blockquote"),
      hasLogoWall: /trusted by|used by|teams at|companies like|backed by/.test(lower),
      hasSecuritySignals: /soc ?2|gdpr|iso 27001|hipaa|encrypt|secure|privacy/.test(lower),
      hasNumbersProof: /\b\d[\d,.]*\s?(k|m|\+|%|x)?\s?(customers|users|teams|companies|reviews|downloads)/.test(lower),
      hasDemoOrTrial: /free trial|book a demo|request a demo|start free|try (it )?free|get started free/.test(lower),
      imageCount: document.images.length,
    },
  };
}

async function shoot(page: Page, auditId: string, label: string, order: number, viewport: { width: number; height: number }) {
  const buf = await page.screenshot({ type: "png" });
  const { elements } = await page.evaluate(collectInPage);
  const rel = await saveFile(auditId, "png", buf);
  const asset = await prisma.asset.create({
    data: { auditId, kind: "screenshot", label, source: "capture", path: rel, mimeType: "image/png", width: viewport.width, height: viewport.height, order },
  });
  return { assetId: asset.id, label, width: viewport.width, height: viewport.height, path: rel, mimeType: "image/png", elements, pageUrl: page.url() } satisfies Screen;
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  // Dismiss common cookie banners so they do not dominate the capture.
  for (const text of ["Accept all", "Accept", "I agree", "Got it", "Allow all"]) {
    const btn = page.getByRole("button", { name: text, exact: true }).first();
    if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
      await btn.click({ timeout: 1000 }).catch(() => {});
      break;
    }
  }
  await page.waitForTimeout(600);
}

async function capturePage(page: Page, auditId: string, url: string, prefix: string, start: number, sections: number) {
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await settle(page);
  const loadMs = Date.now() - t0;
  const { signals } = await page.evaluate(collectInPage);
  const screens: Screen[] = [];
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = page.viewportSize()!.height;
  for (let i = 0; i < sections; i++) {
    const y = i * vh;
    if (i > 0 && y > height - vh * 0.4) break;
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(450);
    const label = i === 0 ? `${prefix}: above the fold` : `${prefix}: section ${i + 1}`;
    screens.push(await shoot(page, auditId, label, start + screens.length, page.viewportSize()!));
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return { screens, signals: { ...signals, url: page.url(), loadMs } as PageSignals };
}

const KEY_PAGES = /(pricing|plans|features|product|how it works|solutions|sign ?up|get started|start free)/i;

async function findKeyLinks(page: Page, origin: string) {
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href]")).map((a) => ({ href: (a as HTMLAnchorElement).href, text: (a as HTMLElement).innerText.trim() })),
  );
  const seen = new Set<string>();
  const picked: { href: string; text: string }[] = [];
  for (const l of links) {
    try {
      const u = new URL(l.href);
      if (u.origin !== origin || u.hash || seen.has(u.pathname) || u.pathname === "/") continue;
      if (!KEY_PAGES.test(l.text) && !KEY_PAGES.test(u.pathname)) continue;
      seen.add(u.pathname);
      picked.push(l);
    } catch {}
  }
  return picked.slice(0, 2);
}

export async function captureLiveUrl(auditId: string, url: string): Promise<CaptureResult> {
  const browser = await launch();
  const notes: string[] = [];
  try {
    const ctx = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1, userAgent: undefined });
    const page = await ctx.newPage();
    const home = await capturePage(page, auditId, url, "Home", 0, 4);
    const screens = [...home.screens];
    const signals = [home.signals];
    const origin = new URL(page.url()).origin;
    for (const link of await findKeyLinks(page, origin)) {
      if (screens.length >= MAX_SCREENS - 1) break;
      try {
        const name = link.text && link.text.length < 24 ? link.text : new URL(link.href).pathname;
        const sub = await capturePage(page, auditId, link.href, name, screens.length, 2);
        screens.push(...sub.screens);
        signals.push(sub.signals);
      } catch {
        notes.push(`Could not capture ${link.href}`);
      }
    }
    const mctx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const mpage = await mctx.newPage();
    try {
      await mpage.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await settle(mpage);
      screens.push(await shoot(mpage, auditId, "Mobile: above the fold", screens.length, MOBILE));
    } catch {
      notes.push("Mobile capture failed");
    }
    return { screens, signals, notes };
  } finally {
    await browser.close();
  }
}

export async function captureDemoAccount(
  auditId: string,
  opts: { loginUrl: string; productUrl: string; email: string; password: string },
): Promise<CaptureResult> {
  const browser = await launch();
  const notes: string[] = [];
  try {
    const ctx = await browser.newContext({ viewport: DESKTOP });
    const page = await ctx.newPage();
    const login = await capturePage(page, auditId, opts.loginUrl, "Login", 0, 1);
    const screens = [...login.screens];
    const signals = [login.signals];

    const emailField = page.locator("input[type=email], input[name*=email i], input[name*=user i], input[id*=email i], input[autocomplete=username]").first();
    const passField = page.locator("input[type=password]").first();
    try {
      await emailField.fill(opts.email, { timeout: 5000 });
      if (!(await passField.isVisible().catch(() => false))) {
        // Two-step login: submit the email first.
        await emailField.press("Enter");
        await passField.waitFor({ timeout: 8000 });
      }
      await passField.fill(opts.password, { timeout: 5000 });
      await Promise.all([page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {}), passField.press("Enter")]);
      await page.waitForTimeout(2500);
    } catch {
      notes.push("Automatic sign-in could not complete; analysis is based on the captured public screens.");
    }

    const loggedIn = !(await passField.isVisible().catch(() => false));
    if (loggedIn) {
      await settle(page);
      const vh = DESKTOP.height;
      for (let i = 0; i < 2; i++) {
        await page.evaluate((top) => window.scrollTo(0, top), i * vh);
        await page.waitForTimeout(400);
        screens.push(await shoot(page, auditId, i === 0 ? "In-app: first screen after sign-in" : "In-app: first screen, lower section", screens.length, DESKTOP));
      }
      const { signals: s } = await page.evaluate(collectInPage);
      signals.push({ ...s, url: page.url(), loadMs: 0 } as PageSignals);
      // Visit primary navigation destinations inside the app.
      const navLinks = await page.evaluate(() =>
        Array.from(document.querySelectorAll("nav a[href], aside a[href], [role=navigation] a[href]"))
          .map((a) => ({ href: (a as HTMLAnchorElement).href, text: (a as HTMLElement).innerText.trim() }))
          .filter((l) => l.text && !/log ?out|sign ?out/i.test(l.text)),
      );
      const origin = new URL(page.url()).origin;
      const seen = new Set([new URL(page.url()).pathname]);
      for (const l of navLinks) {
        if (screens.length >= MAX_SCREENS) break;
        try {
          const u = new URL(l.href);
          if (u.origin !== origin || seen.has(u.pathname)) continue;
          seen.add(u.pathname);
          await page.goto(l.href, { waitUntil: "domcontentloaded", timeout: 20000 });
          await settle(page);
          screens.push(await shoot(page, auditId, `In-app: ${l.text.slice(0, 30)}`, screens.length, DESKTOP));
        } catch {}
      }
    } else {
      notes.push("Sign-in was not confirmed (MFA or a custom login form may be required).");
      if (opts.productUrl) {
        const pub = await capturePage(page, auditId, opts.productUrl, "Public site", screens.length, 2);
        screens.push(...pub.screens);
        signals.push(pub.signals);
      }
    }
    return { screens, signals, notes };
  } finally {
    await browser.close();
  }
}
