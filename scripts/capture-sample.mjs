// Renders the fictional sample product in scripts/sample-site and saves the screenshots used by the sample report.
import { chromium } from "playwright-core";
import path from "node:path";

const exe = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const site = path.resolve("scripts/sample-site");
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const shots = [
  ["index.html", "home.png", { width: 1440, height: 900 }, ["header nav", "h1", ".hero .ctas", ".hero p", "header .btn.b1"]],
  ["index.html#f", "home-2.png", { width: 1440, height: 900 }, [".features", ".band"], 860],
  ["app.html", "app.png", { width: 1440, height: 900 }, ["aside", ".top div", ".grid", ".panels"]],
  ["signup.html", "signup.png", { width: 1440, height: 900 }, ["form.signup", "form.signup button"]],
  ["index.html", "mobile.png", { width: 390, height: 844 }, ["h1", ".hero .ctas"]],
];
for (const [file, out, vp, sels, scroll] of shots) {
  const page = await browser.newPage({ viewport: vp });
  await page.goto("file://" + path.join(site, file.split("#")[0]));
  if (scroll) await page.evaluate((y) => window.scrollTo(0, y), scroll);
  await page.screenshot({ path: path.join("public/sample", out) });
  for (const sel of sels) {
    const r = await page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; if (!els.length) return null; const rs = els.map(e => e.getBoundingClientRect()); const x = Math.min(...rs.map(r=>r.left)), y = Math.min(...rs.map(r=>r.top)), r2 = Math.max(...rs.map(r=>r.right)), b = Math.max(...rs.map(r=>r.bottom)); return {x: x/innerWidth*100, y: y/innerHeight*100, w: (r2-x)/innerWidth*100, h: (b-y)/innerHeight*100}; }, sel);
    console.log(out, sel, JSON.stringify(r && Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v * 10) / 10]))));
  }
  await page.close();
}
await browser.close();
