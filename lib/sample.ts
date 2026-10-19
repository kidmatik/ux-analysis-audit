import { prisma } from "./prisma";
import type { RedesignRecord } from "./redesign";
import { SAMPLE_REDESIGN_CURRENT, SAMPLE_REDESIGN_HEIGHT, SAMPLE_REDESIGN_PINS, SAMPLE_REDESIGN_PLAN } from "./sample-redesign";
import { finalizeReport, type Finding, type ReportCore } from "./report";
import { visibilityScore, visibilitySubScores, visibilityTrack, type CrawledPage, type VisibilityCheck, type VisibilityReport } from "./visibility";

// The public sample report: a fictional B2B SaaS product ("Acme Insights") rendered from
// scripts/sample-site and captured into public/sample by scripts/capture-sample.mjs.

export const SAMPLE_TOKEN = "sample";
// Bump when the sample content changes so the stored sample report is regenerated.
const SAMPLE_VERSION = 4;
const SAMPLE_EMAIL = "sample@ux-analysis-audit.local";

const SHOTS = [
  { path: "/sample/home.png", label: "Home: above the fold", width: 1440, height: 900 },
  { path: "/sample/home-2.png", label: "Home: features section", width: 1440, height: 900 },
  { path: "/sample/signup.png", label: "Sign up", width: 1440, height: 900 },
  { path: "/sample/app.png", label: "In-app: first screen after sign-in", width: 1440, height: 900 },
  { path: "/sample/mobile.png", label: "Mobile: above the fold", width: 390, height: 844 },
];

const F = (f: Finding) => f;

const findings: Finding[] = [
  F({
    id: "F1", category: "messaging", severity: "critical", impact: 5, effort: "low",
    title: "Headline describes a category, not an outcome",
    problem: "The hero headline “The unified, AI-native operational intelligence platform for modern data-driven revenue organizations” is 13 words of category language. It never says what a revenue leader gets, or how fast.",
    whyItMatters: "Visitors decide in seconds whether a page is relevant. Abstract category terms force them to translate the claim into value themselves, and most leave before they do.",
    businessImpact: "This is the highest-traffic element on the site. A vague headline suppresses visitor-to-signup conversion on every paid and organic visit and weakens recall in competitive evaluations.",
    recommendedFix: "Lead with the outcome and the buyer in under ten words, for example “Forecast revenue you can defend in the board meeting.” Move “AI-native” and integration claims to the subheading. A/B test two outcome-led variants against the current headline.",
    annotation: { screenshotIndex: 0, x: 2.6, y: 15.4, w: 49, h: 25.5 }, annotationNote: "13-word category headline",
  }),
  F({
    id: "F2", category: "core_flow", severity: "critical", impact: 5, effort: "low",
    title: "Four equal-weight actions compete in the hero",
    problem: "“Get started”, “Book a demo”, “Watch video” and “Talk to sales” sit side by side with four different colors. The header adds a fifth “Get started”. No action is clearly primary.",
    whyItMatters: "When every option looks equally important, visitors hesitate or pick the least committal one. Choice overload is the most common cause of hero-section drop-off.",
    businessImpact: "Traffic splits across low-value paths such as the video, reducing the share that reaches trial signup, which is the metric this audit was asked to improve.",
    recommendedFix: "Keep one primary button (“Start free trial”) and one secondary text link (“Book a demo”). Remove “Watch video” from the hero and embed the video lower on the page. Use a single accent color for the primary action site-wide.",
    annotation: { screenshotIndex: 0, x: 2.6, y: 57.4, w: 38.8, h: 7.2 }, annotationNote: "4 competing calls to action",
  }),
  F({
    id: "F3", category: "onboarding", severity: "critical", impact: 5, effort: "medium",
    title: "First session lands on an empty dashboard",
    problem: "After sign-up, new users see four KPI tiles reading 0 and four panels reading “No data available”. There is no checklist, sample data or guidance on connecting the first source.",
    whyItMatters: "Activation depends on reaching a first meaningful result quickly. An empty state with no next step leaves new users to figure out setup on their own, which is where most trials stall.",
    businessImpact: "Directly caps trial-to-paid conversion. For a data product, time-to-first-insight is the strongest predictor of conversion and retention.",
    recommendedFix: "Replace the empty home with a three-step setup checklist (connect a source, pick a template dashboard, invite a teammate) with progress, and load a sample dataset so every panel shows a realistic preview until real data arrives.",
    annotation: { screenshotIndex: 3, x: 18.8, y: 9.6, w: 79.2, h: 65.6 }, annotationNote: "Every module empty, no next step",
  }),
  F({
    id: "F4", category: "onboarding", severity: "high", impact: 4, effort: "low",
    title: "Sign-up form asks for eight fields before any value",
    problem: "The trial form requires first name, last name, work email, phone number, company, job title, company size and password. The submit button is labelled “Submit”.",
    whyItMatters: "Completion rates fall sharply after three or four fields, and phone number is the field most associated with abandonment because it signals a sales call.",
    businessImpact: "Direct loss of trial starts at the highest-intent moment in the funnel.",
    recommendedFix: "Reduce to work email and password, or Google sign-in. Collect role and company size inside the product after the first dashboard loads. Rename the button to “Start 14-day trial”.",
    annotation: { screenshotIndex: 2, x: 31.6, y: 11.6, w: 36.8, h: 86 }, annotationNote: "8 required fields",
  }),
  F({
    id: "F5", category: "strategic_risks", severity: "high", impact: 4, effort: "low",
    title: "No customer proof anywhere on the page",
    problem: "There are no customer logos, testimonials, case studies or usage numbers. The only proof is the unsupported claim “processes billions of events every month”.",
    whyItMatters: "For a buyer evaluating a system that will hold revenue data, evidence from similar companies is the strongest de-risking signal available.",
    businessImpact: "Lengthens sales cycles, lowers demo-to-close rates, and reads as weak traction to investors reviewing the product.",
    recommendedFix: "Add a logo strip directly below the hero and one quantified customer outcome (metric, name, role, company) next to the primary call to action. Turn the “Built for scale” band into a proof section with real numbers.",
    annotation: { screenshotIndex: 1, x: 0, y: 76.5, w: 100, h: 23.3 }, annotationNote: "Claim with no evidence",
  }),
  F({
    id: "F6", category: "heuristics", severity: "medium", impact: 3, effort: "low",
    title: "Hero copy is too dense to scan",
    problem: "The subheading is a 60-word single sentence listing six capabilities and an integration count.",
    whyItMatters: "Dense hero copy raises cognitive load and dilutes the one message that should land. Executives and mobile visitors skim, they do not read.",
    businessImpact: "Lower message recall and lower engagement with the primary action.",
    recommendedFix: "Cut the subheading to one sentence of under 20 words that supports the headline outcome. Move the capability list into the features section.",
    annotation: { screenshotIndex: 0, x: 2.6, y: 40.6, w: 48.6, h: 15.6 }, annotationNote: "60-word subheading",
  }),
  F({
    id: "F7", category: "heuristics", severity: "medium", impact: 3, effort: "low",
    title: "Navigation exposes nine top-level choices and no pricing",
    problem: "The header lists Platform, Solutions, Integrations, Customers, Resources, Partners, Company, Careers and Blog. Pricing is not linked.",
    whyItMatters: "Long navigation pulls attention from the conversion path, and hiding pricing pushes self-qualifying buyers to leave and compare elsewhere.",
    businessImpact: "More drift into low-intent pages, fewer self-serve trials, and more unqualified demo requests.",
    recommendedFix: "Reduce to Product, Customers, Pricing and Resources. Move Partners, Company, Careers and Blog into the footer. Show at least the starting price or plan structure.",
    annotation: { screenshotIndex: 0, x: 22.9, y: 2.2, w: 51.2, h: 4.4 }, annotationNote: "9 links, no Pricing",
  }),
  F({
    id: "F8", category: "core_flow", severity: "high", impact: 4, effort: "low",
    title: "Primary action falls below the fold on mobile",
    problem: "On a 390px screen the four-line headline fills the first view. Visitors must scroll past the full subheading before reaching any button.",
    whyItMatters: "A large share of first visits from social, email and ads happen on mobile, and intent drops with every scroll required.",
    businessImpact: "Lower mobile conversion drags down blended acquisition efficiency.",
    recommendedFix: "Shorten the mobile headline, hide the long subheading below 640px, and add a sticky bottom bar with the single primary action.",
    annotation: { screenshotIndex: 4, x: 8, y: 18, w: 84, h: 78 }, annotationNote: "No action in first view",
  }),
  F({
    id: "F9", category: "dashboard", severity: "high", impact: 4, effort: "medium",
    title: "Thirteen navigation items before the first insight",
    problem: "The app sidebar lists 13 destinations, including Datasets, Models, Workflows and Admin, all at the same level as Home.",
    whyItMatters: "New users cannot tell which areas matter now and which are for later. Equal weighting increases the time to find the core workflow.",
    businessImpact: "Slower activation and lower adoption of the features that drive retention.",
    recommendedFix: "Group navigation into Analyze (Dashboards, Explore, Alerts), Build (Metrics, Datasets, Models) and Admin. Collapse the Build and Admin groups for new accounts.",
    annotation: { screenshotIndex: 3, x: 0, y: 0, w: 16.9, h: 100 }, annotationNote: "13 equal-weight items",
  }),
  F({
    id: "F10", category: "dashboard", severity: "medium", impact: 3, effort: "low",
    title: "Toolbar offers four actions with no clear primary",
    problem: "Import, Export, Share and New sit together on the home screen. On an empty account, Export and Share do nothing useful.",
    whyItMatters: "Irrelevant actions add noise and imply the product is complex before the user has done anything.",
    businessImpact: "Adds friction to the first session and reduces perceived ease of use.",
    recommendedFix: "On empty accounts show only “Connect a data source”. Reveal Export and Share once a dashboard exists.",
    annotation: { screenshotIndex: 3, x: 72.8, y: 2.6, w: 25, h: 5.6 }, annotationNote: "Irrelevant actions when empty",
  }),
  F({
    id: "F11", category: "messaging", severity: "medium", impact: 3, effort: "low",
    title: "Feature section lists capabilities, not results",
    problem: "Cards such as “Unified data layer” and “Permissions” describe what the product has. None states what a revenue leader achieves with it.",
    whyItMatters: "Buyers compare outcomes. Feature lists look interchangeable with every competitor in the category.",
    businessImpact: "Weaker differentiation and more price pressure in competitive deals.",
    recommendedFix: "Rewrite each card as a result with a number where possible, for example “Catch pipeline risk two weeks earlier” instead of “Anomaly detection”.",
    annotation: { screenshotIndex: 1, x: 2.6, y: 24, w: 94.8, h: 52 }, annotationNote: "Features without outcomes",
  }),
  F({
    id: "F12", category: "strategic_risks", severity: "medium", impact: 3, effort: "low",
    title: "Security posture is invisible for a data platform",
    problem: "A product that connects CRM, billing and warehouse data shows no mention of security, compliance or data handling.",
    whyItMatters: "Security review is a mandatory step for this category of purchase. Missing information delays deals at procurement.",
    businessImpact: "Longer enterprise sales cycles and avoidable losses at the security review stage.",
    recommendedFix: "Add a security band with compliance status, encryption and data residency, linking to a dedicated trust page.",
    annotation: { screenshotIndex: 1, x: 0, y: 76.5, w: 100, h: 23.3 }, annotationNote: "No trust or compliance signals",
  }),
];

const core: ReportCore = {
  executiveSummary:
    "Acme Insights has a capable product hidden behind category language and an unguided first session. Three blockers account for most of the lost growth: a headline that does not state an outcome, a hero with four competing actions, and an empty first-run dashboard. All three can be addressed within two sprints, and the first two within days.",
  subScores: [
    { key: "value_proposition", score: 41, rationale: "The headline names a category rather than an outcome, and the subheading lists capabilities." },
    { key: "onboarding", score: 38, rationale: "Eight-field sign-up followed by an empty dashboard with no guided first step." },
    { key: "conversion", score: 52, rationale: "Five calls to action across header and hero; primary action below the fold on mobile." },
    { key: "cognitive_load", score: 55, rationale: "Nine marketing navigation items and thirteen in-app destinations at equal weight." },
    { key: "hierarchy", score: 63, rationale: "Clean layout, but dense hero copy and equal-weight modules dilute priority." },
    { key: "trust", score: 44, rationale: "No logos, testimonials, quantified outcomes or security information." },
  ],
  criticalIssues: [
    { findingId: "F1", title: findings[0].title, impactLevel: "critical", businessImpact: findings[0].businessImpact, fix: findings[0].recommendedFix },
    { findingId: "F3", title: findings[2].title, impactLevel: "critical", businessImpact: findings[2].businessImpact, fix: findings[2].recommendedFix },
    { findingId: "F2", title: findings[1].title, impactLevel: "critical", businessImpact: findings[1].businessImpact, fix: findings[1].recommendedFix },
  ],
  findings,
  screenshotLabels: SHOTS.map((s) => s.label),
};


// Fictional AI & search visibility scan of the Acme Insights marketing site.
const ORIGIN = "https://acme-insights.example";
const u = (path: string) => `${ORIGIN}${path}`;
type SamplePage = Omit<CrawledPage, "url" | "issues" | "status"> & { path: string };
const samplePages: SamplePage[] = [
  { path: "/", title: "Acme Insights: AI-native operational intelligence", description: "", h1Count: 1, words: 412, loadMs: 1840, bytes: 186_400, indexable: true, hasStructuredData: false },
  { path: "/pricing", title: "Pricing | Acme Insights", description: "", h1Count: 1, words: 520, loadMs: 1310, bytes: 98_200, indexable: true, hasStructuredData: false },
  { path: "/signup", title: "Sign up | Acme Insights", description: "", h1Count: 0, words: 64, loadMs: 760, bytes: 54_100, indexable: true, hasStructuredData: false },
  { path: "/features", title: "Features | Acme Insights", description: "Unified data layer, anomaly detection, forecasting, dashboards and granular permissions for revenue teams.", h1Count: 2, words: 860, loadMs: 3120, bytes: 642_300, indexable: true, hasStructuredData: false },
  { path: "/blog", title: "Acme Insights Blog", description: "Guides, benchmarks and playbooks on revenue operations, forecasting and pipeline analytics from the Acme Insights team.", h1Count: 1, words: 310, loadMs: 1450, bytes: 120_800, indexable: true, hasStructuredData: false },
  { path: "/blog/revenue-forecasting-guide", title: "Acme Insights Blog", description: "", h1Count: 1, words: 1840, loadMs: 5420, bytes: 210_600, indexable: true, hasStructuredData: true },
  { path: "/about", title: "About Acme Insights | Our mission and team", description: "Acme Insights helps revenue leaders forecast with confidence. Meet the team and investors behind the platform.", h1Count: 1, words: 290, loadMs: 980, bytes: 88_500, indexable: true, hasStructuredData: false },
  { path: "/security", title: "Security | Acme Insights", description: "", h1Count: 1, words: 180, loadMs: 870, bytes: 72_300, indexable: false, hasStructuredData: false },
  { path: "/integrations", title: "120+ integrations for your revenue stack | Acme", description: "Connect Salesforce, HubSpot, Stripe and more.", h1Count: 1, words: 640, loadMs: 1620, bytes: 156_900, indexable: true, hasStructuredData: false },
  { path: "/docs", title: "Documentation | Acme Insights", description: "Set up Acme Insights: connect data sources, define metrics, build dashboards and manage roles and permissions.", h1Count: 1, words: 450, loadMs: 1130, bytes: 110_200, indexable: true, hasStructuredData: false },
];

const V = (c: Omit<VisibilityCheck, "track">): VisibilityCheck => ({ ...c, track: visibilityTrack(c.id) });
const sampleChecks: VisibilityCheck[] = [
  V({ id: "robots_txt", group: "crawlability", label: "robots.txt present", status: "pass", severity: "low", detail: "robots.txt found with 3 user-agent groups and 1 sitemap reference.", fix: "", pages: [] }),
  V({ id: "sitemap", group: "crawlability", label: "XML sitemap", status: "pass", severity: "low", detail: `Sitemap found at ${ORIGIN}/sitemap.xml listing 42 URLs.`, fix: "", pages: [] }),
  V({ id: "search_bots_blocked", group: "crawlability", label: "Search engines can crawl the site", status: "pass", severity: "low", detail: "Googlebot and Bingbot are allowed to crawl the home page.", fix: "", pages: [] }),
  V({ id: "noindex_pages", group: "crawlability", label: "Pages open to indexing", status: "warn", severity: "medium", detail: "1 page of 10 carries noindex (meta robots or X-Robots-Tag): the security page, likely left over from staging.", fix: "Remove noindex from pages you want found in search and AI answers. Keep it only on private, duplicate or thank-you pages.", pages: [u("/security")] }),
  V({ id: "broken_pages", group: "crawlability", label: "No broken internal links", status: "pass", severity: "low", detail: "All 10 crawled pages returned HTTP 200.", fix: "", pages: [] }),
  V({ id: "https", group: "crawlability", label: "Served over HTTPS", status: "pass", severity: "low", detail: `${ORIGIN} is served over HTTPS.`, fix: "", pages: [] }),
  V({ id: "canonical", group: "crawlability", label: "Canonical URLs", status: "warn", severity: "low", detail: "3 of 10 pages have no canonical tag.", fix: 'Add <link rel="canonical" href="..."> with the page\'s own absolute URL to every page to consolidate duplicate URLs.', pages: [u("/blog"), u("/blog/revenue-forecasting-guide"), u("/docs")] }),
  V({ id: "ai_bots_blocked", group: "ai_access", label: "AI crawlers allowed", status: "fail", severity: "high", detail: "robots.txt blocks GPTBot (ChatGPT), CCBot (Common Crawl). These assistants cannot read the site, so it is less likely to be cited or recommended in their answers.", fix: 'Unless blocking is a deliberate policy, replace the blocking groups in robots.txt with an explicit allow for each crawler, e.g. "User-agent: GPTBot / User-agent: CCBot / Allow: / / Disallow: /app/" (keep private app paths disallowed). Re-test with each vendor\'s robots checker, then watch server logs for the crawlers returning within a few days.', pages: [u("/robots.txt")] }),
  V({ id: "llms_txt", group: "ai_access", label: "llms.txt", status: "warn", severity: "low", detail: "No /llms.txt. This emerging convention gives AI assistants a curated summary of the product and links to the most important pages.", fix: 'Publish /llms.txt as Markdown: "# Acme Insights" on the first line, a "> one-sentence summary of what it is and who it is for", a short paragraph on key facts (category, pricing model, integrations), then "## Product", "## Pricing", "## Docs" and "## Customers" sections, each a list of "- [Page title](absolute URL): one-line description". Keep it under 100 lines and update it with each launch.', pages: [] }),
  V({ id: "title_present", group: "metadata", label: "Page titles present", status: "pass", severity: "low", detail: "All 10 pages have a title.", fix: "", pages: [] }),
  V({ id: "title_length", group: "metadata", label: "Title length (30-60 characters)", status: "warn", severity: "low", detail: '7 of 10 titles are outside 30-60 characters: "Pricing | Acme Insights" (23), "Sign up | Acme Insights" (23), "Acme Insights Blog" (18).', fix: "Rewrite titles to 30-60 characters: the page's specific topic or outcome first, then the brand name.", pages: ["/pricing", "/signup", "/features", "/blog", "/blog/revenue-forecasting-guide", "/security", "/docs"].map(u) }),
  V({ id: "duplicate_titles", group: "metadata", label: "Unique page titles", status: "warn", severity: "medium", detail: '2 pages share 1 title, e.g. "Acme Insights Blog" on 2 pages. Every blog article inherits the blog index title.', fix: "Write a distinct title for each page so search engines and AI assistants can tell them apart.", pages: [u("/blog"), u("/blog/revenue-forecasting-guide")] }),
  V({ id: "meta_description", group: "metadata", label: "Meta description present", status: "fail", severity: "medium", detail: "5 of 10 pages have no meta description, including the home page. Search engines and AI previews fall back to arbitrary page text.", fix: "Add a 70-160 character meta description to each page that states who it is for and the outcome it delivers.", pages: ["/", "/pricing", "/signup", "/blog/revenue-forecasting-guide", "/security"].map(u) }),
  V({ id: "description_length", group: "metadata", label: "Description length (70-160 characters)", status: "warn", severity: "low", detail: "1 of 5 descriptions is outside 70-160 characters.", fix: "Keep descriptions between 70 and 160 characters so they are not truncated or padded in results.", pages: [u("/integrations")] }),
  V({ id: "duplicate_descriptions", group: "metadata", label: "Unique meta descriptions", status: "pass", severity: "low", detail: "No duplicate descriptions found.", fix: "", pages: [] }),
  V({ id: "og_tags", group: "metadata", label: "Open Graph sharing tags", status: "warn", severity: "low", detail: "6 of 10 pages are missing og:title or og:image, so links shared in Slack, LinkedIn or chat assistants show no preview.", fix: "Add og:title, og:description and a 1200x630 og:image to every page (and twitter:card).", pages: ["/signup", "/blog", "/blog/revenue-forecasting-guide", "/security", "/integrations", "/docs"].map(u) }),
  V({ id: "structured_data", group: "structured_data", label: "Structured data (JSON-LD)", status: "warn", severity: "medium", detail: "The home page has no JSON-LD, although 1 of 10 other pages does (an Article on the blog).", fix: 'Add a <script type="application/ld+json"> block to the home page with an @graph of: Organization (name, url, logo, sameAs), WebSite (name, url) and SoftwareApplication (name, applicationCategory "BusinessApplication", operatingSystem "Web", offers with price and priceCurrency, aggregateRating if you have reviews). Validate with Google\'s Rich Results Test and the Schema.org validator.', pages: [u("/")] }),
  V({ id: "organization_schema", group: "structured_data", label: "Organization or product schema", status: "warn", severity: "medium", detail: "No Organization, WebSite, Product or SoftwareApplication schema found. AI answers and knowledge panels rely on these to identify the company and its product.", fix: "Add Organization (name, logo, sameAs social profiles) and WebSite schema site-wide, plus SoftwareApplication or Product schema on product and pricing pages.", pages: [u("/")] }),
  V({ id: "single_h1", group: "content", label: "One H1 per page", status: "warn", severity: "medium", detail: "2 of 10 pages do not have exactly one H1 (/signup: 0, /features: 2).", fix: "Use exactly one H1 per page that states the page's main topic; demote other headings to H2.", pages: [u("/signup"), u("/features")] }),
  V({ id: "lang_attr", group: "content", label: "Language declared", status: "pass", severity: "low", detail: "All pages declare a language (en).", fix: "", pages: [] }),
  V({ id: "img_alt", group: "content", label: "Image alt text", status: "fail", severity: "medium", detail: "14 of 38 images (37%) have no alt attribute, so search engines, AI models and screen readers cannot interpret them.", fix: 'Add descriptive alt text to meaningful images (product screenshots, diagrams, logos) and alt="" to purely decorative ones.', pages: ["/", "/features", "/integrations", "/blog/revenue-forecasting-guide"].map(u) }),
  V({ id: "thin_content", group: "content", label: "Substantial page content", status: "warn", severity: "medium", detail: "2 of 10 pages have under 250 words of visible text (/signup: 64, /security: 180). Thin pages give search engines and AI assistants little to quote.", fix: "Expand key pages with specific, answer-style copy: who it is for, the problem, how it works, proof and FAQs.", pages: [u("/signup"), u("/security")] }),
  V({ id: "viewport_meta", group: "content", label: "Mobile viewport", status: "pass", severity: "low", detail: "All pages declare a mobile viewport.", fix: "", pages: [] }),
  V({ id: "entity_schema", group: "structured_data", label: "Brand entity defined", status: "warn", severity: "medium", detail: "No Organization schema, so AI assistants cannot reliably tie the site to the company, its logo and its profiles elsewhere.", fix: 'Add site-wide Organization JSON-LD with "name", "url", "logo" (absolute URL to a square PNG), "description" and "sameAs" listing LinkedIn, Crunchbase, G2, GitHub and X profile URLs. Use the exact same company name everywhere.', pages: [u("/")] }),
  V({ id: "faq_or_qa_content", group: "ai_access", label: "Question-and-answer content", status: "warn", severity: "medium", detail: "None of the 10 pages have question-style headings or FAQPage schema. AI assistants answer user questions; pages that mirror those questions are the ones they quote.", fix: 'Add an FAQ section to the home, pricing and product pages with 5-8 real buyer questions as H2/H3 headings ("How long does setup take?", "How is pricing calculated?") and 40-60 word direct answers, and mark it up with FAQPage JSON-LD.', pages: ["/", "/pricing", "/features"].map(u) }),
  V({ id: "answer_ready_summary", group: "ai_access", label: "Answer-ready summary", status: "warn", severity: "medium", detail: 'The first paragraph on the home page is 58 words of capability list: "Acme Insights connects your CRM, billing, product analytics, support desk and data warehouse…". It never says what the product is or who it is for, so assistants have no definition to quote.', fix: 'Directly under the H1, add a 40-80 word paragraph that reads as a definition: "Acme Insights is a revenue analytics platform for B2B SaaS revenue teams that forecasts pipeline and flags risk two weeks earlier. It connects CRM, billing and product data in minutes, and is used by <proof>." Assistants lift this kind of sentence verbatim.', pages: [u("/")] }),
  V({ id: "author_or_publisher", group: "ai_access", label: "Author and publisher signals", status: "warn", severity: "medium", detail: "2 of 3 blog, docs or guide pages name no author or publisher (no byline, meta author or JSON-LD author). Only the forecasting guide has Article schema with an author.", fix: 'Show a byline with the author\'s name, role and a link to their profile page, and add Article JSON-LD with "author" (Person with name, url, sameAs LinkedIn) and "publisher" (your Organization). Expertise signals make content more likely to be cited.', pages: [u("/blog"), u("/docs")] }),
  V({ id: "freshness", group: "ai_access", label: "Freshness signals", status: "warn", severity: "low", detail: "Only 2 of 10 pages expose a published or modified date (JSON-LD dateModified, article:modified_time, <time> or a Last-Modified header). Answer engines favour content they can tell is current.", fix: 'Add "datePublished" and "dateModified" to each page\'s JSON-LD, show "Updated <month year>" on docs and articles, and send an accurate Last-Modified header from the server or CDN.', pages: ["/", "/pricing", "/signup", "/features", "/about", "/security", "/integrations", "/docs"].map(u) }),
  V({ id: "citable_facts", group: "ai_access", label: "Citable facts and numbers", status: "warn", severity: "medium", detail: '6 of 10 pages state fewer than two concrete numbers (percentages, prices, customer counts, time saved); the home page has 1 ("120 native integrations"). "Billions of events" is not a verifiable figure.', fix: 'Add 3-5 sourced facts per key page: customer count, a quantified customer result ("cut forecast error by 32% at Northwind"), setup time, number of integrations and starting price. Put each in its own short sentence so it can be quoted on its own.', pages: ["/", "/signup", "/features", "/about", "/security", "/docs"].map(u) }),
  V({ id: "heading_structure", group: "content", label: "Logical heading outline", status: "warn", severity: "low", detail: "2 of 10 pages skip heading levels or have long copy with no H2 sections (/features, /security).", fix: "Structure each page as H1 (page topic), H2 per section phrased as the question or benefit it covers, and H3 for details, without skipping levels. AI systems split pages into passages along these headings.", pages: [u("/features"), u("/security")] }),
  V({ id: "page_speed", group: "performance", label: "Fast page response", status: "fail", severity: "high", detail: "2 of 10 pages took over 2.5s to deliver HTML (slowest /blog/revenue-forecasting-guide: 5.4s).", fix: "Cache HTML at the edge (CDN), reduce server work per request and pre-render marketing pages statically.", pages: [u("/features"), u("/blog/revenue-forecasting-guide")] }),
  V({ id: "page_weight", group: "performance", label: "Lean HTML", status: "warn", severity: "low", detail: "1 of 10 pages exceeds 500 KB of HTML (largest 627 KB). Crawlers may truncate very large documents.", fix: "Move inline data, SVG sprites and scripts out of the HTML and lazy-load below-the-fold content.", pages: [u("/features")] }),
];

const sampleSubScores = visibilitySubScores(sampleChecks);
export const sampleVisibility: VisibilityReport = {
  score: visibilityScore(sampleSubScores),
  subScores: sampleSubScores,
  checks: sampleChecks,
  bots: [
    { name: "ClaudeBot", engine: "Claude", allowed: true, rule: "User-agent: * / Allow: /" },
    { name: "GPTBot", engine: "ChatGPT", allowed: false, rule: "User-agent: GPTBot / Disallow: /" },
    { name: "OAI-SearchBot", engine: "ChatGPT search", allowed: true, rule: "User-agent: * / Allow: /" },
    { name: "PerplexityBot", engine: "Perplexity", allowed: true, rule: "User-agent: * / Allow: /" },
    { name: "Google-Extended", engine: "Gemini", allowed: true, rule: "User-agent: * / Allow: /" },
    { name: "CCBot", engine: "Common Crawl", allowed: false, rule: "User-agent: CCBot / Disallow: /" },
    { name: "Googlebot", engine: "Google Search", allowed: true, rule: "User-agent: * / Allow: /" },
    { name: "Bingbot", engine: "Bing", allowed: true, rule: "User-agent: * / Allow: /" },
  ],
  pages: samplePages.map(({ path, ...p }) => ({
    ...p,
    url: u(path),
    status: 200,
    issues: sampleChecks.filter((c) => c.status !== "pass" && c.pages.includes(u(path))).map((c) => c.id),
  })),
  files: { robotsTxt: true, sitemap: true, llmsTxt: false },
  origin: ORIGIN,
  crawledAt: "2026-10-01T09:00:00.000Z",
};

const sampleReport = (assets: { id: string; label: string; width: number | null; height: number | null }[]) => ({
  ...finalizeReport(core, assets.map((a) => ({ assetId: a.id, label: a.label, width: a.width ?? 1440, height: a.height ?? 900 })), "claude"),
  visibility: sampleVisibility,
  sampleVersion: SAMPLE_VERSION,
});

// The sample's One-click Redesign, backed by the images in public/sample.
async function sampleRedesign(auditId: string) {
  await prisma.asset.deleteMany({ where: { auditId, kind: { in: ["redesign", "redesign_html"] } } });
  const shot = (label: string, path: string) =>
    prisma.asset.create({ data: { auditId, kind: "redesign", label, source: "redesign", path, mimeType: "image/png", width: 1440, height: SAMPLE_REDESIGN_HEIGHT } });
  const before = await shot("Before redesign", "/sample/redesign-before.png");
  const after = await shot("After redesign", "/sample/redesign-after.png");
  const html = await prisma.asset.create({ data: { auditId, kind: "redesign_html", label: "Redesigned page", source: "redesign", path: "/sample/redesign.html", mimeType: "text/html" } });
  const record: RedesignRecord = {
    status: "complete",
    stage: 5,
    startedAt: "2026-10-01T09:05:00.000Z",
    generatedAt: "2026-10-01T09:06:00.000Z",
    engine: "claude",
    plan: SAMPLE_REDESIGN_PLAN,
    current: SAMPLE_REDESIGN_CURRENT,
    before: { assetId: before.id, width: 1440, height: SAMPLE_REDESIGN_HEIGHT },
    after: { assetId: after.id, width: 1440, height: SAMPLE_REDESIGN_HEIGHT },
    htmlAssetId: html.id,
    pins: SAMPLE_REDESIGN_PINS,
    notes: [],
  };
  return JSON.stringify(record);
}

export async function ensureSample() {
  const existing = await prisma.audit.findUnique({ where: { shareToken: SAMPLE_TOKEN } });
  if (existing) {
    const stored = existing.report ? (JSON.parse(existing.report) as { sampleVersion?: number }) : null;
    if (stored?.sampleVersion === SAMPLE_VERSION) return existing;
    // Older sample: rebuild the report in place, keeping its screenshots and share link.
    const assets = await prisma.asset.findMany({ where: { auditId: existing.id, kind: "screenshot" }, orderBy: { order: "asc" } });
    const report = sampleReport(assets);
    return prisma.audit.update({ where: { id: existing.id }, data: { report: JSON.stringify(report), growthScore: report.growthScore, redesign: await sampleRedesign(existing.id) } });
  }
  const user = await prisma.user.upsert({
    where: { email: SAMPLE_EMAIL },
    update: {},
    create: { email: SAMPLE_EMAIL, name: "Sample", plan: "pro", provider: "system" },
  });
  const audit = await prisma.audit.create({
    data: {
      userId: user.id,
      productName: "Acme Insights",
      productUrl: "https://acme-insights.example",
      productType: "saas_app",
      growthStage: "series_a",
      primaryGoal: "activation",
      accessMethod: "demo",
      focusAreas: JSON.stringify(["onboarding", "dashboard", "messaging", "core_workflow"]),
      status: "processing",
    },
  });
  const assets = [];
  for (const [i, s] of SHOTS.entries()) {
    assets.push(
      await prisma.asset.create({
        data: { auditId: audit.id, kind: "screenshot", label: s.label, source: "capture", path: s.path, mimeType: "image/png", width: s.width, height: s.height, order: i },
      }),
    );
  }
  const report = sampleReport(assets);
  return prisma.audit.update({
    where: { id: audit.id },
    data: { status: "complete", stage: 5, report: JSON.stringify(report), growthScore: report.growthScore, redesign: await sampleRedesign(audit.id), engine: "sample", completedAt: new Date(), shareToken: SAMPLE_TOKEN, secretsPurgedAt: new Date() },
  });
}
