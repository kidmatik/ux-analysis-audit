// Refreshes the report pages of the static GitHub Pages preview (gh-pages branch) from a running app.
// Usage: start the app (npm run build && npm start) with ALLOW_DEMO_UPGRADE=true and serve
// scripts/sample-site on :8090 (python3 -m http.server 8090), then:
//   node scripts/export-preview.mjs <gh-pages checkout>
// Writes report.html (sample), teaser.html (free) and full-report.html (Pro, with a clickable
// One-click Redesign), the assets they use, and merges the new Next.js static files.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const OUT = path.resolve(process.argv[2] || "gh-pages");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const SITE = "http://localhost:8090/index.html";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });

function inject(page, extra = "", submit = "") {
  return `<script>
(function(){
  var PAGE="${page}", SUBMIT="${submit}";
  function go(href){ window.location.href = new URL(href, window.location.href).href; }
  function toast(msg){
    var t=document.createElement("div"); t.textContent=msg;
    t.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;background:#0e1325;color:#fff;padding:12px 18px;border-radius:12px;font:500 14px/1.4 system-ui,sans-serif;box-shadow:0 10px 30px rgb(0 0 0/.25);max-width:90vw;text-align:center";
    document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 2800);
  }
  window.addEventListener("click", function(e){
    var el=e.target.closest && e.target.closest("a,button"); if(!el) return;
    var text=(el.textContent||"").trim();
    if(el.tagName==="A"){
      var h=el.getAttribute("href")||"";
      if(/^https?:/.test(h) || el.hasAttribute("download")) return;
      if(h.charAt(0)==="#"){ return; }
      e.preventDefault(); e.stopImmediatePropagation();
      if(h==="#"||!h){ toast("This link works in the deployed app."); return; }
      if(/\\.(pdf|html?)(\\?|$)/.test(h) && el.target==="_blank"){ window.open(h,"_blank"); return; }
      if(/\\.pdf$/.test(h)){ window.open(h,"_blank"); return; }
      go(h); return;
    }
    if(/^Start Audit/.test(text)){ e.preventDefault(); e.stopImmediatePropagation(); go("processing.html"); return; }
    if(/^Go Pro/.test(text)){ e.preventDefault(); e.stopImmediatePropagation(); go(/redesign/i.test(text)?"full-report.html#redesign":"full-report.html"); return; }
    if(/^(Share link|Export to Notion|Continue with Google|Sign out|Downgrade)/.test(text)){ e.preventDefault(); e.stopImmediatePropagation(); toast("\\u201c"+text+"\\u201d works in the deployed app."); }
  }, true);
  window.addEventListener("submit", function(e){
    e.preventDefault(); e.stopImmediatePropagation();
    if(SUBMIT){ go(SUBMIT); } else { toast("Thanks. In the deployed app this request is saved and sent."); }
  }, true);
  if(PAGE==="processing"){ setTimeout(function(){ go("teaser.html"); }, 9000); }
  ${extra}
  // The preview has no API; quietly answer the calls the pages make so nothing errors.
  var json=function(v){ return Promise.resolve(new Response(JSON.stringify(v),{headers:{"content-type":"application/json"}})); };
  var f=window.fetch; window.fetch=function(u,o){
    var s=String(u&&u.url||u);
    if(/\\/api\\/audits\\/[^/]+$/.test(s)){ var k=(window.__stage=(window.__stage||0)+1); return json({status:k>3?"complete":"processing",stage:Math.min(4,k)}); }
    if(/\\/redesign$/.test(s) && window.__REDESIGN){
      // Simulates a redesign run: a few progress polls, then the finished redesign.
      if(o&&o.method==="POST"){ window.__rs=0; return json({status:"processing",stage:0,startedAt:new Date().toISOString()}); }
      var n=(window.__rs=(window.__rs||0)+1);
      return json(n>4?window.__REDESIGN:{status:"processing",stage:n,startedAt:new Date().toISOString()});
    }
    if(/\\/api\\/|_rsc=|^\\//.test(s)) return json({});
    return f.apply(this,arguments);
  };
})();
</script>`;
}

const assets = new Map();
// Rewrites app URLs into the preview's relative files.
function rewrite(html) {
  return html
    .replace(/\/api\/assets\/([a-z0-9]+)(?:\?t=[\w-]+)?/g, (_, id) => {
      assets.set(id, true);
      return `assets/${id}.__EXT_${id}__`;
    })
    .replace(/\/_next\/static\//g, "next/static/")
    .replace(/(\\?["'])\/sample\//g, "$1sample/")
    // Page links, only where they are hrefs (in the HTML and in the React payload).
    .replace(/(href="|\\"href\\":\\")\/(r\/sample|sample)(?=["\\#])/g, "$1report.html")
    .replace(/(href="|\\"href\\":\\")\/audits\/new(?=["\\#?])/g, "$1wizard.html")
    .replace(/(href="|\\"href\\":\\")\/(upgrade|dashboard|signup|login)(?=["\\#?])/g, "$1$2.html")
    .replace(/(href="|\\"href\\":\\")\/(?=["\\#])/g, "$1landing.html")
    .replace(/\/api\/audits\/[a-z0-9]+\/pdf(?:\?t=[\w-]+)?/g, "sample-report.pdf")
    .replace(/(__EXT_[a-z0-9]+__)&amp;download=1/g, "$1?download=1")
    .replace(/http:\/\/localhost:8090\/index\.html/g, "https://acme-insights.example")
    .replace(/localhost:8090/g, "acme-insights.example");
}

const fetchHtml = async (ctx, url) => (await ctx.request.get(url)).text();

async function save(ctx, name, html, page, extra = "", token = "", submit = "") {
  let out = rewrite(html).replace("<head>", "<head>" + inject(page, rewrite(extra), submit));
  for (const id of assets.keys()) {
    const file = fs.readdirSync(path.join(OUT, "assets")).find((f) => f.startsWith(id + "."));
    let ext = file?.split(".").pop();
    if (!ext) {
      const res = await ctx.request.get(`${BASE}/api/assets/${id}${token ? `?t=${token}` : ""}`);
      if (res.ok()) {
        ext = /html/.test(res.headers()["content-type"]) ? "html" : "png";
        let body = await res.body();
        // The sample site is not online: inline its stylesheet so the redesigned copy renders on its own.
        if (ext === "html") body = Buffer.from(body.toString("utf8").replace(/<link rel="stylesheet" href="style\.css">/, `<style>${fs.readFileSync("scripts/sample-site/style.css", "utf8")}</style>`));
        fs.writeFileSync(path.join(OUT, "assets", `${id}.${ext}`), body);
      }
    }
    out = out.replaceAll(`__EXT_${id}__`, ext || "png");
  }
  fs.writeFileSync(path.join(OUT, name), out);
  console.log("wrote", name);
}

fs.mkdirSync(path.join(OUT, "assets"), { recursive: true });
fs.mkdirSync(path.join(OUT, "sample"), { recursive: true });
for (const f of fs.readdirSync("public/sample")) fs.copyFileSync(path.join("public/sample", f), path.join(OUT, "sample", f));
fs.cpSync(".next/static", path.join(OUT, "next/static"), { recursive: true });
// GitHub Pages serves the preview from a sub-path: make chunk and font URLs relative.
for (const dir of ["chunks", "css"]) {
  for (const f of fs.readdirSync(path.join(OUT, "next/static", dir))) {
    const file = path.join(OUT, "next/static", dir, f);
    if (!/\.(js|css)$/.test(f)) continue;
    const src = fs.readFileSync(file, "utf8");
    const out = src.replace(/r\.p="\/_next\/"/g, 'r.p="next/"').replace(/url\(\/_next\/static\/media\//g, "url(../media/");
    if (out !== src) fs.writeFileSync(file, out);
  }
}

// Public pages and the sample report (anonymous)
const anon = await browser.newContext();
await anon.request.get(`${BASE}/sample`);
await save(anon, "report.html", await fetchHtml(anon, `${BASE}/r/sample`), "report", "", "sample");
await save(anon, "landing.html", await fetchHtml(anon, `${BASE}/`), "landing", "", "", "signup.html");
await save(anon, "login.html", await fetchHtml(anon, `${BASE}/login`), "login", "", "", "dashboard.html");
await save(anon, "signup.html", await fetchHtml(anon, `${BASE}/signup`), "signup", "", "", "dashboard.html");

// Free teaser, then Pro with a clickable redesign
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/signup`);
await page.fill("input[name=name]", "Preview");
await page.fill("input[name=email]", `preview${Date.now()}@example.com`);
await page.fill("input[name=password]", "password123");
await page.click("button[type=submit]");
await page.waitForURL("**/audits/new");
await save(ctx, "wizard.html", await fetchHtml(ctx, `${BASE}/audits/new`), "wizard");
await page.fill("input[placeholder='Acme Analytics']", "Acme Insights");
await page.fill("input[placeholder='https://acme.com']", SITE);
await page.selectOption("select >> nth=0", "saas_app");
await page.click("text=Continue");
await page.click("text=Continue");
await page.click("text=Start Audit");
await page.waitForURL("**/processing");
await save(ctx, "processing.html", await fetchHtml(ctx, page.url()), "processing");
await page.waitForURL(/\/audits\/c[^/]+$/, { timeout: 180000 });
const reportUrl = page.url().split("#")[0];
await save(ctx, "teaser.html", await fetchHtml(ctx, reportUrl), "teaser");
await save(ctx, "dashboard.html", (await fetchHtml(ctx, `${BASE}/dashboard`)).replaceAll(new URL(reportUrl).pathname, "teaser.html"), "dashboard");
await save(ctx, "upgrade.html", await fetchHtml(ctx, `${BASE}/upgrade`), "upgrade");
await page.goto(`${BASE}/upgrade`);
await page.click("text=Go Pro, $39/month");
await page.waitForURL("**/dashboard?upgraded=1");
// Capture the Pro page before the redesign exists, so the preview shows the one-click button.
const proHtml = await fetchHtml(ctx, reportUrl);
const api = reportUrl.replace("/audits/", "/api/audits/") + "/redesign";
await ctx.request.post(api);
let view;
for (let i = 0; i < 90; i++) {
  view = await (await ctx.request.get(api)).json();
  if (view?.status !== "processing") break;
  await new Promise((r) => setTimeout(r, 2000));
}
if (view?.status !== "complete") throw new Error("Redesign did not complete: " + JSON.stringify(view).slice(0, 300));
// Clicking the button in the preview plays the progress steps, then shows this finished redesign.
await save(ctx, "full-report.html", proHtml, "full", `window.__REDESIGN=${JSON.stringify(view).replace(/</g, "\\u003c")};`);
await browser.close();
