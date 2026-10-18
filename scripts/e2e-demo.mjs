// Exercises the demo-account and external live-URL paths against a running server.
import { chromium } from "playwright-core";
const BASE = "http://localhost:3000";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${BASE}/signup`);
await page.fill("input[name=name]", "Demo Tester");
await page.fill("input[name=email]", `demo${Date.now()}@example.com`);
await page.fill("input[name=password]", "password123");
await page.click("button[type=submit]");
await page.waitForURL("**/audits/new");
await page.request.post(`${BASE}/api/billing/upgrade`, { data: {} });
async function run(payload) {
  const res = await page.request.post(`${BASE}/api/audits`, { multipart: { payload: JSON.stringify(payload) } });
  const { id, error } = await res.json();
  if (!id) return console.log("create failed", error);
  for (let i = 0; i < 90; i++) {
    const s = await (await page.request.get(`${BASE}/api/audits/${id}`)).json();
    if (s.status === "complete" || s.status === "failed") { console.log(payload.accessMethod, s.status, s.error ?? "", id); return id; }
    await page.waitForTimeout(2000);
  }
}
const base = { productName: "Test", productType: "saas_app", growthStage: "seed", primaryGoal: "activation", focusAreas: ["onboarding"] };
await run({ ...base, accessMethod: "demo", productUrl: "http://localhost:8090/index.html", demo: { loginUrl: "http://localhost:8090/signup.html", email: "a@b.co", password: "secret-pass" } });
await run({ ...base, productName: "Example", accessMethod: "url", productUrl: "https://example.com" });
await browser.close();
