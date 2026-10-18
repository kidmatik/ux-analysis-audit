// AI & search visibility: the second audit pillar. Shared types and scoring, safe for client use.

export const VISIBILITY_SUB_SCORES = [
  { key: "crawlability", label: "Crawlability & indexing", weight: 0.25 },
  { key: "ai_access", label: "AI search access", weight: 0.2 },
  { key: "metadata", label: "Titles, descriptions & sharing", weight: 0.2 },
  { key: "structured_data", label: "Structured data", weight: 0.15 },
  { key: "content", label: "Content structure", weight: 0.1 },
  { key: "performance", label: "Speed & page weight", weight: 0.1 },
] as const;

export type VisibilityKey = (typeof VISIBILITY_SUB_SCORES)[number]["key"];

export type CheckStatus = "pass" | "warn" | "fail";

export type VisibilityCheck = {
  id: string; // stable, e.g. "robots_txt", "meta_description"
  group: VisibilityKey;
  track: "seo" | "geo"; // classic search (SEO) or AI answer engines (GEO)
  label: string; // e.g. "Meta description present"
  status: CheckStatus;
  severity: "critical" | "high" | "medium" | "low"; // used when status is not "pass"
  detail: string; // what was measured, e.g. "3 of 8 pages have no meta description"
  fix: string; // how to fix it ("" when gated)
  pages: string[]; // affected page URLs
};

export type BotAccess = {
  name: string; // "ClaudeBot", "GPTBot", "PerplexityBot", "Google-Extended", "Googlebot", "Bingbot", "CCBot"
  engine: string; // "Claude", "ChatGPT", "Perplexity", "Gemini", "Google Search", "Bing", "Common Crawl"
  allowed: boolean;
  rule: string; // the robots.txt rule that decided it, or "No rule (allowed)"
};

export type CrawledPage = {
  url: string;
  status: number; // HTTP status, 0 if it failed
  title: string;
  description: string;
  h1Count: number;
  words: number;
  loadMs: number;
  bytes: number;
  indexable: boolean;
  hasStructuredData: boolean;
  issues: string[]; // check ids failing or warning on this page
};

export type VisibilityReport = {
  score: number; // 0-100, weighted from subScores
  subScores: { key: VisibilityKey; score: number }[];
  checks: VisibilityCheck[];
  bots: BotAccess[];
  pages: CrawledPage[];
  files: { robotsTxt: boolean; sitemap: boolean; llmsTxt: boolean };
  origin: string;
  crawledAt: string;
};

export function visibilityScore(subScores: VisibilityReport["subScores"]) {
  let total = 0;
  let weights = 0;
  for (const def of VISIBILITY_SUB_SCORES) {
    const s = subScores.find((x) => x.key === def.key);
    if (!s) continue;
    total += Math.max(0, Math.min(100, s.score)) * def.weight;
    weights += def.weight;
  }
  return weights ? Math.round(total / weights) : 0;
}

// Overall audit score when both pillars are present: UX carries more weight.
export function overallScore(ux: number, visibility: number | null | undefined) {
  return visibility == null ? ux : Math.round(ux * 0.6 + visibility * 0.4);
}

const SEVERITY_PENALTY = { critical: 45, high: 25, medium: 12, low: 5 } as const;

// Each group starts at 100 and loses points per failing check by severity; warnings count half.
export function visibilitySubScores(checks: VisibilityCheck[]): VisibilityReport["subScores"] {
  return VISIBILITY_SUB_SCORES.map((def) => {
    let s = 100;
    for (const c of checks) if (c.group === def.key && c.status !== "pass") s -= SEVERITY_PENALTY[c.severity] * (c.status === "warn" ? 0.5 : 1);
    return { key: def.key, score: Math.max(0, Math.min(100, Math.round(s))) };
  });
}

// Checks that matter mainly for AI answer engines (GEO); everything else is classic search (SEO).
export const GEO_CHECKS = new Set([
  "ai_bots_blocked",
  "llms_txt",
  "structured_data",
  "entity_schema",
  "faq_or_qa_content",
  "answer_ready_summary",
  "author_or_publisher",
  "freshness",
  "citable_facts",
  "heading_structure",
]);

export const visibilityTrack = (id: string): VisibilityCheck["track"] => (GEO_CHECKS.has(id) ? "geo" : "seo");
