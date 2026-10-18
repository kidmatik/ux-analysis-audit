import {
  visibilityScore,
  visibilitySubScores,
  visibilityTrack,
  type BotAccess,
  type CrawledPage,
  type VisibilityCheck,
  type VisibilityKey,
  type VisibilityReport,
} from "../visibility";

// AI & search visibility audit: robots.txt, sitemap, llms.txt and a small same-origin crawl,
// scored as deterministic checks. Uses plain HTTP (no browser), so it can run alongside capture.

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const TIMEOUT_MS = 10_000;
const MAX_PAGES = 10;
const MAX_BYTES = 5_000_000;

export const BOTS: { name: string; engine: string; ai: boolean; training?: boolean }[] = [
  { name: "ClaudeBot", engine: "Claude", ai: true },
  { name: "GPTBot", engine: "ChatGPT", ai: true },
  { name: "OAI-SearchBot", engine: "ChatGPT search", ai: true },
  { name: "PerplexityBot", engine: "Perplexity", ai: true },
  { name: "Google-Extended", engine: "Gemini", ai: true, training: true },
  { name: "CCBot", engine: "Common Crawl", ai: true, training: true },
  { name: "Googlebot", engine: "Google Search", ai: false },
  { name: "Bingbot", engine: "Bing", ai: false },
];

// ---------- HTTP ----------

type Fetched = { url: string; status: number; headers: Headers; body: string; ms: number; bytes: number; html: boolean };

async function get(url: string): Promise<Fetched | null> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5" },
    });
    const type = res.headers.get("content-type") ?? "";
    const textual = !type || /text|html|xml|json/i.test(type);
    const buf = textual ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0);
    if (!textual) await res.body?.cancel().catch(() => {});
    const body = buf.subarray(0, MAX_BYTES).toString("utf8");
    return { url: res.url || url, status: res.status, headers: res.headers, body, ms: Date.now() - t0, bytes: buf.length, html: /html/i.test(type) || (!type && /<html/i.test(body)) };
  } catch {
    return null;
  }
}

// SPA hosts often answer every path with the app shell; that is not a robots.txt or llms.txt.
const isRealTextFile = (r: Fetched | null) => !!r && r.status === 200 && !r.html && !/^\s*<(!doctype|html)/i.test(r.body);

// ---------- robots.txt ----------

export type RobotsRule = { allow: boolean; path: string };
export type RobotsGroup = { agents: string[]; rules: RobotsRule[] };

export function parseRobots(txt: string): { groups: RobotsGroup[]; sitemaps: string[] } {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    if (key === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }
    lastWasAgent = false;
    if ((key === "allow" || key === "disallow") && current) {
      // An empty Disallow means "allow everything" and is not a rule.
      if (value) current.rules.push({ allow: key === "allow", path: value });
    }
  }
  return { groups, sitemaps };
}

function ruleMatches(pattern: string, path: string) {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = new RegExp("^" + body.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (anchored ? "$" : ""));
  return re.test(path);
}

// Google-style resolution: the most specific matching user-agent group (merged if repeated),
// falling back to "*"; within it the longest matching rule wins and Allow wins ties.
export function robotsDecision(robots: ReturnType<typeof parseRobots>, bot: string, path = "/"): { allowed: boolean; rule: string } {
  const token = bot.toLowerCase();
  let best = "";
  for (const g of robots.groups) {
    for (const a of g.agents) {
      if (a !== "*" && (token === a || token.startsWith(a)) && a.length > best.length) best = a;
    }
  }
  const agent = best || "*";
  const groups = robots.groups.filter((g) => g.agents.includes(agent));
  if (!groups.length) return { allowed: true, rule: "No rule (allowed)" };
  let winner: RobotsRule | null = null;
  for (const r of groups.flatMap((g) => g.rules)) {
    if (!ruleMatches(r.path, path)) continue;
    if (!winner || r.path.length > winner.path.length || (r.path.length === winner.path.length && r.allow && !winner.allow)) winner = r;
  }
  const ua = agent === "*" ? "*" : bot;
  if (!winner) return { allowed: true, rule: `No rule for "${path}" (User-agent: ${ua}, allowed)` };
  return { allowed: winner.allow, rule: `User-agent: ${ua} / ${winner.allow ? "Allow" : "Disallow"}: ${winner.path}` };
}

// ---------- HTML parsing ----------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…" };
const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z0-9#]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();

function attrs(tag: string) {
  const out: Record<string, string> = {};
  const re = /([^\s=/<>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  const inner = tag.replace(/^<\s*[\w-]+/, "").replace(/\/?>$/, "");
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner))) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  return out;
}

const tags = (html: string, name: string) => html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];

function jsonLdTypes(html: string) {
  const types: string[] = [];
  const objects: Record<string, unknown>[] = [];
  let blocks = 0;
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      objects.push(o);
      const t = o["@type"];
      if (typeof t === "string") types.push(t);
      else if (Array.isArray(t)) types.push(...t.filter((x): x is string => typeof x === "string"));
      if (o["@graph"]) walk(o["@graph"]);
    }
  };
  while ((m = re.exec(html))) {
    blocks++;
    try {
      walk(JSON.parse(m[1].trim()));
    } catch {
      /* invalid JSON-LD still counts as present */
    }
  }
  return { blocks, types, objects };
}

type Parsed = {
  title: string;
  titleTags: number;
  description: string;
  hasDescription: boolean;
  meta: Record<string, string>;
  canonical: string;
  lang: string;
  h1Count: number;
  words: number;
  images: number;
  imagesNoAlt: number;
  ld: ReturnType<typeof jsonLdTypes>;
  links: string[];
  headings: { level: number; text: string }[];
  paragraphs: string[]; // first paragraphs of body copy, in order
  text: string; // visible text
  hasAuthor: boolean;
  dates: string[]; // published or modified dates found in the markup
};

export function parseHtml(html: string): Parsed {
  const head = html.match(/<head\b[\s\S]*?<\/head>/i)?.[0] ?? html;
  const titleMatch = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) ?? html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const meta: Record<string, string> = {};
  for (const t of tags(html, "meta")) {
    const a = attrs(t);
    const key = (a.name || a.property || a["http-equiv"] || "").toLowerCase();
    if (key && !(key in meta)) meta[key] = a.content ?? "";
  }
  const canonical = tags(html, "link").map(attrs).find((a) => (a.rel || "").toLowerCase().split(/\s+/).includes("canonical"))?.href ?? "";
  const imgs = tags(html, "img").map(attrs);
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const visible = decode(text);
  const words = visible.split(" ").filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const strip = (h: string) => decode(h.replace(/<[^>]+>/g, " "));
  const body = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|noscript|svg|template|head|nav|header|footer)\b[\s\S]*?<\/\1>/gi, " ");
  const headings = [...body.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({ level: Number(m[1]), text: strip(m[2]) }));
  const paragraphs = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].slice(0, 12).map((m) => strip(m[1])).filter(Boolean);
  const ld = jsonLdTypes(html);
  const hasAuthor =
    !!meta.author ||
    !!meta["article:author"] ||
    ld.objects.some((o) => o.author || o.publisher) ||
    /rel\s*=\s*["']?author|itemprop\s*=\s*["']?author|class\s*=\s*["'][^"']*\b(author|byline)\b/i.test(html);
  const dates = [
    meta["article:modified_time"],
    meta["article:published_time"],
    meta["og:updated_time"],
    ...ld.objects.flatMap((o) => [o.dateModified, o.datePublished]),
    ...tags(html, "time").map((t) => attrs(t).datetime),
  ].filter((d): d is string => typeof d === "string" && !Number.isNaN(Date.parse(d)));
  return {
    title: titleMatch ? decode(titleMatch[1]) : "",
    titleTags: (html.match(/<title\b/gi) ?? []).length,
    description: meta.description ?? "",
    hasDescription: "description" in meta,
    meta,
    canonical,
    lang: attrs(html.match(/<html\b[^>]*>/i)?.[0] ?? "<html>").lang ?? "",
    h1Count: (html.match(/<h1[\s>]/gi) ?? []).length,
    words,
    images: imgs.length,
    imagesNoAlt: imgs.filter((a) => !("alt" in a)).length,
    ld,
    links: tags(html, "a").map((t) => attrs(t).href).filter((h): h is string => !!h),
    headings,
    paragraphs,
    text: visible,
    hasAuthor,
    dates,
  };
}

// ---------- crawl ----------

const ASSET = /\.(png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|json|xml|txt|pdf|zip|gz|mp4|webm|mov|mp3|wav|woff2?|ttf|eot|csv|xlsx?|docx?|pptx?|dmg|exe)$/i;

function normalize(href: string, base: string, origin: string): string | null {
  if (/^(mailto|tel|javascript|data|sms):/i.test(href.trim()) || href.trim().startsWith("#")) return null;
  try {
    const u = new URL(href, base);
    if (u.origin !== origin || !/^https?:$/.test(u.protocol)) return null;
    if (ASSET.test(u.pathname)) return null;
    u.hash = "";
    u.search = "";
    return u.toString();
  } catch {
    return null;
  }
}

const pathKey = (u: string) => {
  const p = new URL(u).pathname.replace(/\/index\.html?$/i, "/").replace(/\/+$/, "");
  return p || "/";
};
const depth = (u: string) => pathKey(u).split("/").filter(Boolean).length;

type PageData = CrawledPage & { parsed: Parsed | null; finalUrl: string; noindex: boolean; canonicalElsewhere: boolean; html: boolean; lastModified: string };

function pageFrom(url: string, r: Fetched | null): PageData {
  const base = { url, status: r?.status ?? 0, title: "", description: "", h1Count: 0, words: 0, loadMs: r?.ms ?? 0, bytes: r?.bytes ?? 0, indexable: false, hasStructuredData: false, issues: [] as string[] };
  if (!r || !r.html) return { ...base, parsed: null, finalUrl: r?.url ?? url, noindex: false, canonicalElsewhere: false, html: !!r?.html, lastModified: "" };
  const p = parseHtml(r.body);
  const robotsMeta = `${p.meta.robots ?? ""} ${p.meta.googlebot ?? ""} ${r.headers.get("x-robots-tag") ?? ""}`.toLowerCase();
  const noindex = /noindex|\bnone\b/.test(robotsMeta);
  let canonicalElsewhere = false;
  if (p.canonical) {
    try {
      canonicalElsewhere = pathKey(new URL(p.canonical, r.url).toString()) !== pathKey(r.url) || new URL(p.canonical, r.url).origin !== new URL(r.url).origin;
    } catch {
      /* unparsable canonical is ignored */
    }
  }
  return {
    ...base,
    title: p.title,
    description: p.description,
    h1Count: p.h1Count,
    words: p.words,
    indexable: r.status === 200 && !noindex && !canonicalElsewhere,
    hasStructuredData: p.ld.blocks > 0,
    parsed: p,
    finalUrl: r.url,
    noindex,
    canonicalElsewhere,
    html: true,
    lastModified: r.headers.get("last-modified") ?? "",
  };
}

async function sitemapUrls(candidates: string[], origin: string) {
  for (const sm of candidates) {
    const r = await get(sm);
    if (!r || r.status !== 200 || !/<(urlset|sitemapindex)\b/i.test(r.body)) continue;
    let locs = [...r.body.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)].map((m) => decode(m[1]));
    if (/<sitemapindex\b/i.test(r.body) && locs[0]) {
      const child = await get(locs[0]);
      locs = child ? [...child.body.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)].map((m) => decode(m[1])) : [];
    }
    return { url: r.url, urls: locs.map((l) => normalize(l, origin, origin)).filter((u): u is string => !!u).slice(0, 200) };
  }
  return null;
}

// ---------- checks ----------

type CheckInput = Omit<VisibilityCheck, "pages" | "fix" | "severity" | "track"> & { severity?: VisibilityCheck["severity"]; fix?: string; pages?: string[] };
const check = (c: CheckInput): VisibilityCheck => ({ severity: "low", fix: "", pages: [], track: visibilityTrack(c.id), ...c });
const pass = (id: string, group: VisibilityKey, label: string, detail: string) => check({ id, group, label, status: "pass", detail });
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export async function auditVisibility(url: string): Promise<VisibilityReport> {
  let start: URL;
  try {
    start = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  } catch {
    throw new Error(`"${url}" is not a valid web address.`);
  }
  const home = await get(start.toString());
  if (!home) throw new Error(`We could not reach ${start.origin}. Check that the site is public and online, then retry.`);
  if (home.status >= 400) throw new Error(`${start.origin} responded with HTTP ${home.status}, so its search visibility could not be audited.`);
  const origin = new URL(home.url).origin;

  // robots.txt, sitemap and llms.txt in parallel
  const [robotsRes, llmsRes] = await Promise.all([get(`${origin}/robots.txt`), get(`${origin}/llms.txt`)]);
  const robotsOk = isRealTextFile(robotsRes);
  const robots = parseRobots(robotsOk ? robotsRes!.body : "");
  const robotsServerError = !!robotsRes && robotsRes.status >= 500;
  const sitemap = await sitemapUrls(robots.sitemaps.length ? robots.sitemaps : [`${origin}/sitemap.xml`], origin);
  const llmsOk = isRealTextFile(llmsRes);

  const bots: BotAccess[] = BOTS.map((b) => {
    const d = robotsOk ? robotsDecision(robots, b.name) : { allowed: true, rule: robotsServerError ? `robots.txt returned HTTP ${robotsRes!.status}` : "No robots.txt (allowed)" };
    return { name: b.name, engine: b.engine, allowed: d.allowed, rule: d.rule };
  });

  // Crawl: start page, then same-origin links breadth-first, shortest paths first, topped up from the sitemap.
  const pages: PageData[] = [pageFrom(home.url, home)];
  const seen = new Set<string>([pathKey(home.url), pathKey(start.toString())]);
  let frontier = pages;
  while (pages.length < MAX_PAGES) {
    const found: string[] = [];
    for (const p of frontier) {
      for (const href of p.parsed?.links ?? []) {
        const u = normalize(href, p.finalUrl, origin);
        if (u && !seen.has(pathKey(u))) {
          seen.add(pathKey(u));
          found.push(u);
        }
      }
    }
    if (!found.length) {
      for (const u of sitemap?.urls ?? []) {
        if (!seen.has(pathKey(u))) {
          seen.add(pathKey(u));
          found.push(u);
        }
      }
    }
    if (!found.length) break;
    found.sort((a, b) => depth(a) - depth(b) || pathKey(a).length - pathKey(b).length);
    const batch = found.slice(0, MAX_PAGES - pages.length);
    const fetched: PageData[] = [];
    for (let i = 0; i < batch.length; i += 4) {
      const chunk = await Promise.all(batch.slice(i, i + 4).map(async (u) => pageFrom(u, await get(u))));
      fetched.push(...chunk);
    }
    // Redirects can land on a page that was already crawled.
    for (const p of fetched) {
      if (pages.some((q) => q.finalUrl === p.finalUrl && q.status === p.status)) continue;
      pages.push(p);
    }
    frontier = fetched;
  }

  const ok = pages.filter((p) => p.status === 200 && p.html && p.parsed);
  const P = (list: PageData[]) => list.map((p) => p.url);
  const total = ok.length;
  const homePage = pages[0];
  const hp = homePage.parsed;
  const checks: VisibilityCheck[] = [];

  // Crawlability & indexing
  checks.push(
    robotsServerError
      ? check({ id: "robots_txt", group: "crawlability", label: "robots.txt reachable", status: "fail", severity: "high", detail: `robots.txt returned HTTP ${robotsRes!.status}. Google treats a failing robots.txt as "do not crawl" until it recovers.`, fix: "Serve robots.txt with HTTP 200 (or 404 if you have none) so crawlers are not paused." })
      : robotsOk
        ? pass("robots_txt", "crawlability", "robots.txt present", `robots.txt found with ${plural(robots.groups.length, "user-agent group")} and ${plural(robots.sitemaps.length, "sitemap reference")}.`)
        : check({ id: "robots_txt", group: "crawlability", label: "robots.txt present", status: "warn", severity: "low", detail: "No robots.txt at the site root. Crawlers assume everything is allowed, but you have no place to declare your sitemap or AI crawler policy.", fix: "Add /robots.txt that allows search and AI crawlers and references your sitemap with a Sitemap: line." }),
  );
  checks.push(
    sitemap
      ? pass("sitemap", "crawlability", "XML sitemap", `Sitemap found at ${sitemap.url} listing ${plural(sitemap.urls.length, "URL")}.`)
      : check({ id: "sitemap", group: "crawlability", label: "XML sitemap", status: "warn", severity: "medium", detail: robots.sitemaps.length ? `robots.txt points to ${robots.sitemaps[0]} but it did not return a valid sitemap.` : "No sitemap referenced in robots.txt and none at /sitemap.xml.", fix: "Publish /sitemap.xml with every indexable page and add a Sitemap: line to robots.txt, then submit it in Google Search Console and Bing Webmaster Tools." }),
  );
  const searchBlocked = bots.filter((b) => !b.allowed && !BOTS.find((x) => x.name === b.name)!.ai);
  checks.push(
    searchBlocked.length
      ? check({ id: "search_bots_blocked", group: "crawlability", label: "Search engines can crawl the site", status: "fail", severity: "critical", detail: `robots.txt blocks ${searchBlocked.map((b) => `${b.name} (${b.rule})`).join(", ")}. The site cannot rank in ${searchBlocked.map((b) => b.engine).join(" or ")}.`, fix: `Remove the Disallow rule for ${searchBlocked.map((b) => b.name).join(" and ")} in robots.txt. Use noindex on individual pages instead of blocking the whole site.`, pages: [`${origin}/robots.txt`] })
      : pass("search_bots_blocked", "crawlability", "Search engines can crawl the site", "Googlebot and Bingbot are allowed to crawl the home page."),
  );
  const noindex = pages.filter((p) => p.noindex);
  const homeNoindex = homePage.noindex;
  checks.push(
    noindex.length
      ? check({ id: "noindex_pages", group: "crawlability", label: "Pages open to indexing", status: homeNoindex ? "fail" : "warn", severity: homeNoindex ? "critical" : "medium", detail: `${plural(noindex.length, "page")} of ${pages.length} carry noindex (meta robots or X-Robots-Tag)${homeNoindex ? ", including the home page" : ""}.`, fix: "Remove noindex from pages you want found in search and AI answers. Keep it only on private, duplicate or thank-you pages.", pages: P(noindex) })
      : pass("noindex_pages", "crawlability", "Pages open to indexing", `None of the ${plural(pages.length, "crawled page")} are marked noindex.`),
  );
  const broken = pages.filter((p) => p.status !== 200 && p !== homePage);
  checks.push(
    broken.length
      ? check({ id: "broken_pages", group: "crawlability", label: "No broken internal links", status: "fail", severity: "high", detail: `${plural(broken.length, "linked page")} failed: ${broken.map((p) => `${pathKey(p.url)} (${p.status || "no response"})`).join(", ")}.`, fix: "Fix or redirect (301) the broken URLs and update the internal links that point to them.", pages: P(broken) })
      : pass("broken_pages", "crawlability", "No broken internal links", `All ${plural(pages.length, "crawled page")} returned HTTP 200.`),
  );
  checks.push(
    origin.startsWith("https:")
      ? pass("https", "crawlability", "Served over HTTPS", `${origin} is served over HTTPS.`)
      : check({ id: "https", group: "crawlability", label: "Served over HTTPS", status: "fail", severity: "high", detail: `${origin} is served over plain HTTP. Browsers flag it as not secure and search engines rank it lower.`, fix: "Install a TLS certificate, serve every page over HTTPS and 301-redirect HTTP to HTTPS.", pages: [origin] }),
  );
  const canonElsewhere = ok.filter((p) => p.canonicalElsewhere);
  const noCanon = ok.filter((p) => !p.parsed!.canonical);
  checks.push(
    canonElsewhere.length
      ? check({ id: "canonical", group: "crawlability", label: "Canonical URLs", status: "warn", severity: "medium", detail: `${plural(canonElsewhere.length, "page")} declare a canonical URL that points to a different page, so they will not be indexed themselves.`, fix: "Point each page's canonical tag at its own URL unless it is a true duplicate.", pages: P(canonElsewhere) })
      : noCanon.length
        ? check({ id: "canonical", group: "crawlability", label: "Canonical URLs", status: "warn", severity: "low", detail: `${noCanon.length} of ${total} pages have no canonical tag.`, fix: 'Add <link rel="canonical" href="..."> with the page\'s own absolute URL to every page to consolidate duplicate URLs.', pages: P(noCanon) })
        : pass("canonical", "crawlability", "Canonical URLs", `All ${total} pages declare a self-referencing canonical URL.`),
  );

  // AI search access
  const aiBlocked = bots.filter((b) => !b.allowed && BOTS.find((x) => x.name === b.name)!.ai);
  const answerBlocked = aiBlocked.filter((b) => !BOTS.find((x) => x.name === b.name)!.training);
  checks.push(
    aiBlocked.length
      ? check({ id: "ai_bots_blocked", group: "ai_access", label: "AI crawlers allowed", status: answerBlocked.length ? "fail" : "warn", severity: answerBlocked.length ? "high" : "medium", detail: `robots.txt blocks ${aiBlocked.map((b) => `${b.name} (${b.engine})`).join(", ")}. ${answerBlocked.length ? "These assistants cannot read the site, so it is less likely to be cited or recommended in their answers." : "These are training crawlers; blocking them limits how well future models know the brand."}`, fix: `Unless blocking is a deliberate policy, replace the blocking group in robots.txt with an explicit allow for each crawler, e.g. "${aiBlocked.map((b) => `User-agent: ${b.name}`).join(" / ")} / Allow: / / Disallow: /app/" (keep private app paths disallowed). Re-test with each vendor's robots checker, then watch server logs for the crawlers returning within a few days.`, pages: [`${origin}/robots.txt`] })
      : pass("ai_bots_blocked", "ai_access", "AI crawlers allowed", `All ${BOTS.filter((b) => b.ai).length} AI crawlers checked can read the home page.`),
  );
  checks.push(
    llmsOk
      ? pass("llms_txt", "ai_access", "llms.txt", `llms.txt found (${plural((llmsRes!.body.match(/\]\(/g) ?? []).length, "link")}).`)
      : check({ id: "llms_txt", group: "ai_access", label: "llms.txt", status: "warn", severity: "low", detail: "No /llms.txt. This emerging convention gives AI assistants a curated summary of the product and links to the most important pages.", fix: 'Publish /llms.txt as Markdown: "# <Product>" on the first line, a "> one-sentence summary of what it is and who it is for", a short paragraph on key facts (category, pricing model, integrations), then "## Product", "## Pricing", "## Docs" and "## Customers" sections, each a list of "- [Page title](absolute URL): one-line description". Keep it under 100 lines and update it with each launch.' }),
  );

  // Titles, descriptions & sharing
  const noTitle = ok.filter((p) => !p.title);
  checks.push(
    noTitle.length
      ? check({ id: "title_present", group: "metadata", label: "Page titles present", status: "fail", severity: "high", detail: `${noTitle.length} of ${total} pages have no <title>.`, fix: "Give every page a unique <title> that names the page topic and the brand.", pages: P(noTitle) })
      : pass("title_present", "metadata", "Page titles present", `All ${total} pages have a title.`),
  );
  const badTitleLen = ok.filter((p) => p.title && (p.title.length < 30 || p.title.length > 60));
  checks.push(
    badTitleLen.length
      ? check({ id: "title_length", group: "metadata", label: "Title length (30-60 characters)", status: "warn", severity: "low", detail: `${badTitleLen.length} of ${total} titles are outside 30-60 characters: ${badTitleLen.slice(0, 3).map((p) => `"${p.title.slice(0, 70)}" (${p.title.length})`).join(", ")}.`, fix: "Rewrite titles to 30-60 characters: the page's specific topic or outcome first, then the brand name.", pages: P(badTitleLen) })
      : pass("title_length", "metadata", "Title length (30-60 characters)", "All titles are 30-60 characters."),
  );
  const dupGroups = (key: (p: PageData) => string) => {
    const m = new Map<string, PageData[]>();
    for (const p of ok) {
      const k = key(p).toLowerCase();
      if (k) m.set(k, [...(m.get(k) ?? []), p]);
    }
    return [...m.values()].filter((g) => g.length > 1);
  };
  const dupTitles = dupGroups((p) => p.title);
  checks.push(
    dupTitles.length
      ? check({ id: "duplicate_titles", group: "metadata", label: "Unique page titles", status: "warn", severity: "medium", detail: `${plural(dupTitles.flat().length, "page")} share ${plural(dupTitles.length, "title")}, e.g. "${dupTitles[0][0].title}" on ${dupTitles[0].length} pages.`, fix: "Write a distinct title for each page so search engines and AI assistants can tell them apart.", pages: P(dupTitles.flat()) })
      : pass("duplicate_titles", "metadata", "Unique page titles", "No duplicate titles found."),
  );
  const noDesc = ok.filter((p) => !p.description);
  checks.push(
    noDesc.length
      ? check({ id: "meta_description", group: "metadata", label: "Meta description present", status: hp && !homePage.description ? "fail" : "warn", severity: "medium", detail: `${noDesc.length} of ${total} pages have no meta description${hp && !homePage.description ? ", including the home page" : ""}. Search engines and AI previews fall back to arbitrary page text.`, fix: "Add a 70-160 character meta description to each page that states who it is for and the outcome it delivers.", pages: P(noDesc) })
      : pass("meta_description", "metadata", "Meta description present", `All ${total} pages have a meta description.`),
  );
  const badDescLen = ok.filter((p) => p.description && (p.description.length < 70 || p.description.length > 160));
  checks.push(
    badDescLen.length
      ? check({ id: "description_length", group: "metadata", label: "Description length (70-160 characters)", status: "warn", severity: "low", detail: `${badDescLen.length} of ${total - noDesc.length} descriptions are outside 70-160 characters.`, fix: "Keep descriptions between 70 and 160 characters so they are not truncated or padded in results.", pages: P(badDescLen) })
      : pass("description_length", "metadata", "Description length (70-160 characters)", "All descriptions are 70-160 characters."),
  );
  const dupDesc = dupGroups((p) => p.description);
  checks.push(
    dupDesc.length
      ? check({ id: "duplicate_descriptions", group: "metadata", label: "Unique meta descriptions", status: "warn", severity: "low", detail: `${plural(dupDesc.flat().length, "page")} reuse ${plural(dupDesc.length, "description")}.`, fix: "Write a specific description for each page instead of reusing the home page copy.", pages: P(dupDesc.flat()) })
      : pass("duplicate_descriptions", "metadata", "Unique meta descriptions", "No duplicate descriptions found."),
  );
  const noOg = ok.filter((p) => !p.parsed!.meta["og:title"] || !p.parsed!.meta["og:image"]);
  checks.push(
    noOg.length
      ? check({ id: "og_tags", group: "metadata", label: "Open Graph sharing tags", status: "warn", severity: noOg.includes(homePage) ? "medium" : "low", detail: `${noOg.length} of ${total} pages are missing og:title or og:image, so links shared in Slack, LinkedIn or chat assistants show no preview.`, fix: "Add og:title, og:description and a 1200x630 og:image to every page (and twitter:card).", pages: P(noOg) })
      : pass("og_tags", "metadata", "Open Graph sharing tags", "All pages have og:title and og:image."),
  );

  // Structured data
  const withLd = ok.filter((p) => p.hasStructuredData);
  checks.push(
    hp && hp.ld.blocks
      ? pass("structured_data", "structured_data", "Structured data (JSON-LD)", `Home page has ${plural(hp.ld.blocks, "JSON-LD block")}; ${withLd.length} of ${total} pages have structured data.`)
      : check({ id: "structured_data", group: "structured_data", label: "Structured data (JSON-LD)", status: withLd.length ? "warn" : "fail", severity: withLd.length ? "medium" : "high", detail: withLd.length ? `The home page has no JSON-LD, although ${withLd.length} of ${total} other pages do.` : `None of the ${total} pages include JSON-LD structured data. Search engines and AI assistants must guess what the product is, who makes it and what it costs.`, fix: 'Add a <script type="application/ld+json"> block to the home page with an @graph of: Organization (name, url, logo, sameAs), WebSite (name, url) and SoftwareApplication (name, applicationCategory "BusinessApplication", operatingSystem "Web", offers with price and priceCurrency, aggregateRating if you have reviews). Validate with Google\'s Rich Results Test and the Schema.org validator.', pages: [homePage.url] }),
  );
  const ENTITY = /^(Organization|Corporation|LocalBusiness|WebSite|Product|SoftwareApplication|WebApplication|MobileApplication|Service|Brand)$/i;
  const entityTypes = [...new Set(ok.flatMap((p) => p.parsed!.ld.types).filter((t) => ENTITY.test(t)))];
  checks.push(
    entityTypes.length
      ? pass("organization_schema", "structured_data", "Organization or product schema", `Entity types found: ${entityTypes.join(", ")}.`)
      : check({ id: "organization_schema", group: "structured_data", label: "Organization or product schema", status: "warn", severity: "medium", detail: "No Organization, WebSite, Product or SoftwareApplication schema found. AI answers and knowledge panels rely on these to identify the company and its product.", fix: "Add Organization (name, logo, sameAs social profiles) and WebSite schema site-wide, plus SoftwareApplication or Product schema on product and pricing pages.", pages: [homePage.url] }),
  );

  // Content structure
  const badH1 = ok.filter((p) => p.h1Count !== 1);
  checks.push(
    badH1.length
      ? check({ id: "single_h1", group: "content", label: "One H1 per page", status: hp && homePage.h1Count === 0 ? "fail" : "warn", severity: "medium", detail: `${badH1.length} of ${total} pages do not have exactly one H1 (${badH1.slice(0, 4).map((p) => `${pathKey(p.url)}: ${p.h1Count}`).join(", ")}).`, fix: "Use exactly one H1 per page that states the page's main topic; demote other headings to H2.", pages: P(badH1) })
      : pass("single_h1", "content", "One H1 per page", `All ${total} pages have exactly one H1.`),
  );
  const noLang = ok.filter((p) => !p.parsed!.lang);
  checks.push(
    noLang.length
      ? check({ id: "lang_attr", group: "content", label: "Language declared", status: "warn", severity: "low", detail: `${noLang.length} of ${total} pages have no lang attribute on <html>.`, fix: 'Set <html lang="en"> (or the right language code) on every page.', pages: P(noLang) })
      : pass("lang_attr", "content", "Language declared", `All pages declare a language (${hp?.lang || ok[0]?.parsed?.lang}).`),
  );
  const imgs = ok.reduce((n, p) => n + p.parsed!.images, 0);
  const noAlt = ok.reduce((n, p) => n + p.parsed!.imagesNoAlt, 0);
  const altShare = imgs ? noAlt / imgs : 0;
  checks.push(
    noAlt
      ? check({ id: "img_alt", group: "content", label: "Image alt text", status: altShare > 0.25 ? "fail" : "warn", severity: altShare > 0.25 ? "medium" : "low", detail: `${noAlt} of ${imgs} images (${Math.round(altShare * 100)}%) have no alt attribute, so search engines, AI models and screen readers cannot interpret them.`, fix: 'Add descriptive alt text to meaningful images (product screenshots, diagrams, logos) and alt="" to purely decorative ones.', pages: P(ok.filter((p) => p.parsed!.imagesNoAlt)) })
      : pass("img_alt", "content", "Image alt text", imgs ? `All ${imgs} images have an alt attribute.` : "No images found on crawled pages."),
  );
  const thin = ok.filter((p) => p.words < 250);
  checks.push(
    thin.length
      ? check({ id: "thin_content", group: "content", label: "Substantial page content", status: thin.includes(homePage) ? "fail" : "warn", severity: "medium", detail: `${thin.length} of ${total} pages have under 250 words of visible text (${thin.slice(0, 4).map((p) => `${pathKey(p.url)}: ${p.words}`).join(", ")}). Thin pages give search engines and AI assistants little to quote.`, fix: "Expand key pages with specific, answer-style copy: who it is for, the problem, how it works, proof and FAQs.", pages: P(thin) })
      : pass("thin_content", "content", "Substantial page content", `All ${total} pages have at least 250 words.`),
  );
  const noViewport = ok.filter((p) => !p.parsed!.meta.viewport);
  checks.push(
    noViewport.length
      ? check({ id: "viewport_meta", group: "content", label: "Mobile viewport", status: "fail", severity: "high", detail: `${noViewport.length} of ${total} pages have no viewport meta tag, so they render as zoomed-out desktop pages on phones. Google indexes the mobile version first.`, fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to every page.', pages: P(noViewport) })
      : pass("viewport_meta", "content", "Mobile viewport", "All pages declare a mobile viewport."),
  );

  // GEO: signals AI answer engines use to understand, trust and quote a page
  const orgs = ok.flatMap((p) => p.parsed!.ld.objects).filter((o) => /^(Organization|Corporation|LocalBusiness)$/i.test(String(o["@type"])));
  const sameAs = (o: Record<string, unknown>) => (Array.isArray(o.sameAs) ? o.sameAs.length : o.sameAs ? 1 : 0);
  const bestOrg = [...orgs].sort((a, b) => Number(!!b.logo) + sameAs(b) - (Number(!!a.logo) + sameAs(a)))[0];
  const missingOrg = bestOrg ? ["name", "logo", "sameAs"].filter((k) => !(k === "sameAs" ? sameAs(bestOrg) : bestOrg[k])) : [];
  checks.push(
    bestOrg && !missingOrg.length
      ? pass("entity_schema", "structured_data", "Brand entity defined", `Organization schema names the brand, its logo and ${plural(sameAs(bestOrg), "sameAs profile")}.`)
      : check({ id: "entity_schema", group: "structured_data", label: "Brand entity defined", status: "warn", severity: bestOrg ? "low" : "medium", detail: bestOrg ? `Organization schema is missing ${missingOrg.join(", ")}. AI assistants use these to connect the site to the brand's other profiles.` : "No Organization schema, so AI assistants cannot reliably tie the site to the company, its logo and its profiles elsewhere.", fix: 'Add site-wide Organization JSON-LD with "name", "url", "logo" (absolute URL to a square PNG), "description" and "sameAs" listing LinkedIn, Crunchbase, G2, GitHub and X profile URLs. Use the exact same company name everywhere.', pages: [homePage.url] }),
  );

  const QUESTION = /\?\s*$|^(how|what|why|when|which|who|can|does|do|is|are|should|will)\b/i;
  const qaPages = ok.filter((p) => p.parsed!.ld.types.some((t) => /^(FAQPage|QAPage|HowTo)$/i.test(t)) || p.parsed!.headings.filter((h) => h.level > 1 && QUESTION.test(h.text)).length >= 2);
  checks.push(
    qaPages.length
      ? pass("faq_or_qa_content", "ai_access", "Question-and-answer content", `${qaPages.length} of ${total} pages answer questions directly (FAQ schema or question-style headings).`)
      : check({ id: "faq_or_qa_content", group: "ai_access", label: "Question-and-answer content", status: "warn", severity: "medium", detail: `None of the ${total} pages have question-style headings or FAQPage schema. AI assistants answer user questions; pages that mirror those questions are the ones they quote.`, fix: 'Add an FAQ section to the home, pricing and product pages with 5-8 real buyer questions as H2/H3 headings ("How long does setup take?", "How is pricing calculated?") and 40-60 word direct answers, and mark it up with FAQPage JSON-LD.', pages: P(ok.slice(0, 3)) }),
  );

  const intro = hp?.paragraphs.find((t) => t.split(" ").length >= 12) ?? "";
  const introWords = intro ? intro.split(" ").length : 0;
  const introOk = introWords >= 30 && introWords <= 90;
  checks.push(
    introOk
      ? pass("answer_ready_summary", "ai_access", "Answer-ready summary", `The home page opens with a ${introWords}-word summary paragraph an assistant can quote.`)
      : check({ id: "answer_ready_summary", group: "ai_access", label: "Answer-ready summary", status: "warn", severity: "medium", detail: intro ? `The first paragraph on the home page is ${introWords} words${introWords > 90 ? ", too long to be quoted as a definition" : ", too short to define the product"}: "${intro.slice(0, 90)}${intro.length > 90 ? "…" : ""}".` : "The home page has no summary paragraph near the top; the opening copy is headings and buttons only.", fix: 'Directly under the H1, add a 40-80 word paragraph that reads as a definition: "<Product> is a <category> for <audience> that <primary outcome>. It <how it works in one clause>, and is used by <proof>." Assistants lift this kind of sentence verbatim.', pages: hp ? [homePage.url] : [] }),
  );

  const ARTICLE = /\/(blog|docs|doc|guides?|articles?|news|resources|insights|posts?|learn|help|kb)(\/|$)/i;
  const articles = ok.filter((p) => ARTICLE.test(new URL(p.url).pathname) && p !== homePage);
  const noAuthor = articles.filter((p) => !p.parsed!.hasAuthor);
  checks.push(
    !articles.length
      ? pass("author_or_publisher", "ai_access", "Author and publisher signals", "No blog, docs or guide pages among the crawled pages.")
      : noAuthor.length
        ? check({ id: "author_or_publisher", group: "ai_access", label: "Author and publisher signals", status: "warn", severity: "medium", detail: `${noAuthor.length} of ${articles.length} blog, docs or guide pages name no author or publisher (no byline, meta author or JSON-LD author).`, fix: 'Show a byline with the author\'s name, role and a link to their profile page, and add Article JSON-LD with "author" (Person with name, url, sameAs LinkedIn) and "publisher" (your Organization). Expertise signals make content more likely to be cited.', pages: P(noAuthor) })
        : pass("author_or_publisher", "ai_access", "Author and publisher signals", `All ${articles.length} blog, docs or guide pages name an author or publisher.`),
  );

  const dated = ok.filter((p) => p.parsed!.dates.length || p.lastModified);
  const allDates = ok.flatMap((p) => [...p.parsed!.dates, p.lastModified].filter(Boolean).map((d) => Date.parse(d))).filter((d) => !Number.isNaN(d));
  const newest = allDates.length ? Math.max(...allDates) : 0;
  const staleDays = newest ? Math.round((Date.now() - newest) / 86_400_000) : 0;
  checks.push(
    dated.length * 2 < total
      ? check({ id: "freshness", group: "ai_access", label: "Freshness signals", status: "warn", severity: "low", detail: `Only ${dated.length} of ${total} pages expose a published or modified date (JSON-LD dateModified, article:modified_time, <time> or a Last-Modified header). Answer engines favour content they can tell is current.`, fix: 'Add "datePublished" and "dateModified" to each page\'s JSON-LD, show "Updated <month year>" on docs and articles, and send an accurate Last-Modified header from the server or CDN.', pages: P(ok.filter((p) => !dated.includes(p))) })
      : staleDays > 365
        ? check({ id: "freshness", group: "ai_access", label: "Freshness signals", status: "warn", severity: "low", detail: `The most recent date found on any page is ${staleDays} days old.`, fix: "Refresh key pages with current numbers and examples at least twice a year and update dateModified when you do.", pages: P(dated) })
        : pass("freshness", "ai_access", "Freshness signals", `${dated.length} of ${total} pages expose a date${newest ? `; newest ${new Date(newest).toISOString().slice(0, 10)}` : ""}.`),
  );

  const FACT = /(\d[\d,.]*\s?(%|percent|x\b|×|k\b|m\b|bn\b|million|billion|\+))|([$€£]\s?\d)|(\b\d[\d,.]*\s+(customers|teams|companies|users|hours|days|minutes|integrations|countries|reviews|employees)\b)/gi;
  const factCount = (p: PageData) => (p.parsed!.text.match(FACT) ?? []).length;
  const factless = ok.filter((p) => factCount(p) < 2);
  checks.push(
    factless.length * 2 > total || (hp && factCount(homePage) < 2)
      ? check({ id: "citable_facts", group: "ai_access", label: "Citable facts and numbers", status: "warn", severity: "medium", detail: `${factless.length} of ${total} pages state fewer than two concrete numbers (percentages, prices, customer counts, time saved)${hp ? `; the home page has ${factCount(homePage)}` : ""}. Assistants prefer to quote specific, verifiable claims.`, fix: 'Add 3-5 sourced facts per key page: customer count, a quantified customer result ("cut forecast error by 32% at Northwind"), setup time, number of integrations and starting price. Put each in its own short sentence so it can be quoted on its own.', pages: P(factless) })
      : pass("citable_facts", "ai_access", "Citable facts and numbers", `${total - factless.length} of ${total} pages state at least two concrete numbers.`),
  );

  const badOutline = ok.filter((p) => {
    const hs = p.parsed!.headings;
    const skips = hs.some((h, i) => i > 0 && h.level > hs[i - 1].level + 1);
    return skips || (p.words > 300 && !hs.some((h) => h.level === 2));
  });
  checks.push(
    badOutline.length
      ? check({ id: "heading_structure", group: "content", label: "Logical heading outline", status: "warn", severity: "low", detail: `${badOutline.length} of ${total} pages skip heading levels or have long copy with no H2 sections (${badOutline.slice(0, 3).map((p) => pathKey(p.url)).join(", ")}).`, fix: "Structure each page as H1 (page topic), H2 per section phrased as the question or benefit it covers, and H3 for details, without skipping levels. AI systems split pages into passages along these headings.", pages: P(badOutline) })
      : pass("heading_structure", "content", "Logical heading outline", `All ${total} pages follow a logical H1-H2-H3 outline.`),
  );

  // Speed & page weight (server response plus HTML download, not full render)
  const slowFail = ok.filter((p) => p.loadMs > 5000);
  const slow = ok.filter((p) => p.loadMs > 2500);
  const slowest = [...ok].sort((a, b) => b.loadMs - a.loadMs)[0];
  checks.push(
    slow.length
      ? check({ id: "page_speed", group: "performance", label: "Fast page response", status: slowFail.length ? "fail" : "warn", severity: slowFail.length ? "high" : "medium", detail: `${slow.length} of ${total} pages took over 2.5s to deliver HTML (slowest ${pathKey(slowest.url)}: ${(slowest.loadMs / 1000).toFixed(1)}s).`, fix: "Cache HTML at the edge (CDN), reduce server work per request and pre-render marketing pages statically.", pages: P(slow) })
      : pass("page_speed", "performance", "Fast page response", slowest ? `All pages delivered HTML in under 2.5s (slowest ${(slowest.loadMs / 1000).toFixed(2)}s).` : "No pages measured."),
  );
  const heavy = ok.filter((p) => p.bytes > 500_000);
  const heaviest = heavy.length ? Math.max(...heavy.map((p) => p.bytes)) : 0;
  checks.push(
    heavy.length
      ? check({ id: "page_weight", group: "performance", label: "Lean HTML", status: heaviest > 1_500_000 ? "fail" : "warn", severity: heaviest > 1_500_000 ? "medium" : "low", detail: `${heavy.length} of ${total} pages exceed 500 KB of HTML (largest ${Math.round(heaviest / 1024)} KB). Crawlers may truncate very large documents.`, fix: "Move inline data, SVG sprites and scripts out of the HTML and lazy-load below-the-fold content.", pages: P(heavy) })
      : pass("page_weight", "performance", "Lean HTML", `All pages are under 500 KB of HTML.`),
  );

  // Attach issues to pages and score each group
  const byUrl = new Map(pages.map((p) => [p.url, p]));
  for (const c of checks) if (c.status !== "pass") for (const u of c.pages) byUrl.get(u)?.issues.push(c.id);
  const subScores = visibilitySubScores(checks);

  return {
    score: visibilityScore(subScores),
    subScores,
    checks,
    bots,
    pages: pages.map((p) => ({ url: p.url, status: p.status, title: p.title, description: p.description, h1Count: p.h1Count, words: p.words, loadMs: p.loadMs, bytes: p.bytes, indexable: p.indexable, hasStructuredData: p.hasStructuredData, issues: p.issues })),
    files: { robotsTxt: robotsOk, sitemap: !!sitemap, llmsTxt: llmsOk },
    origin,
    crawledAt: new Date().toISOString(),
  };
}

// One line per failing check, for the analysis prompt.
export function visibilitySummary(v: VisibilityReport) {
  const failing = v.checks.filter((c) => c.status !== "pass");
  if (!failing.length) return `AI & search visibility score ${v.score}/100; all checks pass.`;
  return `AI & search visibility score ${v.score}/100. Issues: ${failing.map((c) => `${c.label} (${c.status}, ${c.severity}): ${c.detail}`).join(" ")}`;
}
