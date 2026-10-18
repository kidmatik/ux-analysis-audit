// Applies the sample redesign plan to scripts/sample-site and writes the before/after images and
// redesigned HTML used by the sample report. Run: npx tsx scripts/capture-sample-redesign.mts
import fs from "node:fs";
import path from "node:path";
import { launch } from "../lib/engine/capture";
import { applyPlan, pageHeight, readCurrentStyle, snapshotHtml, toPins } from "../lib/engine/redesign";
import { SAMPLE_REDESIGN_PLAN } from "../lib/sample-redesign";

const site = "file://" + path.resolve("scripts/sample-site/index.html");
const out = path.resolve("public/sample");
const browser = await launch();
const open = async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  // tsx keeps function names with a helper the browser does not have.
  await page.addInitScript(() => ((window as unknown as { __name: (f: unknown) => unknown }).__name = (f) => f));
  await page.goto(site);
  await page.waitForTimeout(300);
  return page;
};
const page = await open();
const current = await page.evaluate(readCurrentStyle);
const raw = await page.evaluate(applyPlan, SAMPLE_REDESIGN_PLAN);
const height = Math.min(2000, await page.evaluate(pageHeight));
await page.screenshot({ path: path.join(out, "redesign-after.png"), fullPage: true, clip: { x: 0, y: 0, width: 1440, height } });
const beforePage = await open();
await beforePage.screenshot({ path: path.join(out, "redesign-before.png"), fullPage: true, clip: { x: 0, y: 0, width: 1440, height } });
const html = await page.evaluate(snapshotHtml, "https://acme-insights.example/");
fs.writeFileSync(path.join(out, "redesign.html"), html.replace(/<link rel="stylesheet" href="style\.css">/, `<style>${fs.readFileSync(path.resolve("scripts/sample-site/style.css"), "utf8")}</style>`));
const round = (n: number) => Math.round(n * 10) / 10;
console.log("height", height);
console.log("pins", JSON.stringify(toPins(raw, 1440, height).map((p) => ({ copyIndex: p.copyIndex, x: round(p.x), y: round(p.y), w: round(p.w), h: round(p.h) }))));
console.log("current", JSON.stringify(current));
await browser.close();
