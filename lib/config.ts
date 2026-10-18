// Product-level configuration: dropdown options, focus areas, pricing copy.
// Edit here to change what the wizard and landing page show.

export const PRODUCT_TYPES = [
  { value: "website", label: "Marketing website" },
  { value: "landing_page", label: "Landing page" },
  { value: "saas_app", label: "SaaS web application" },
  { value: "dashboard", label: "Dashboard / analytics product" },
  { value: "platform", label: "Complex system / platform" },
  { value: "marketplace", label: "Marketplace" },
  { value: "devtool", label: "Developer tool / API product" },
  { value: "mobile_web", label: "Mobile web app" },
] as const;

export const GROWTH_STAGES = [
  { value: "pre_seed", label: "Pre-seed / MVP" },
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
  { value: "series_b_plus", label: "Series B+" },
  { value: "pre_fundraise", label: "Preparing to fundraise" },
] as const;

export const PRIMARY_GOALS = [
  { value: "conversion", label: "Increase visitor-to-signup conversion" },
  { value: "activation", label: "Improve activation and onboarding" },
  { value: "retention", label: "Improve retention and engagement" },
  { value: "monetization", label: "Increase trial-to-paid conversion" },
  { value: "positioning", label: "Sharpen positioning and messaging" },
  { value: "fundraise", label: "Prepare product for investor diligence" },
] as const;

export const ACCESS_METHODS = [
  { value: "url", label: "Live URL", description: "We capture and analyze a public website, landing page or product." },
  { value: "demo", label: "Demo account", description: "Provide temporary login access to your app. Credentials are deleted after analysis." },
  { value: "figma", label: "Figma file", description: "Connect a Figma file and we analyze the frames directly." },
  { value: "recording", label: "Guided recording", description: "Walk through your product while we record key screens." },
  { value: "upload", label: "Upload", description: "Upload screenshots, design exports or a video, or paste a Loom link." },
] as const;

export const FOCUS_AREAS = [
  { value: "onboarding", label: "Onboarding" },
  { value: "dashboard", label: "Dashboard" },
  { value: "core_workflow", label: "Core workflow" },
  { value: "messaging", label: "Messaging" },
  { value: "monetization", label: "Monetization" },
  { value: "ux_consistency", label: "UX consistency" },
  { value: "discoverability", label: "Feature discoverability" },
] as const;

export const FINDING_CATEGORIES = [
  { value: "onboarding", label: "Onboarding" },
  { value: "dashboard", label: "Dashboard" },
  { value: "core_flow", label: "Core Flow" },
  { value: "messaging", label: "Messaging" },
  { value: "heuristics", label: "Heuristics" },
  { value: "strategic_risks", label: "Strategic Risks" },
] as const;

export const PROCESSING_STAGES = [
  "Capturing screens",
  "Mapping flows",
  "Evaluating UX heuristics",
  "Identifying growth blockers",
  "Generating executive action plan",
] as const;

export const FREE_SCAN_LIMIT = 1;

export const PRICING = [
  {
    key: "free",
    name: "First Scan",
    price: "$0",
    cadence: "one scan",
    description: "Your first product scan, free. A preview of what is blocking growth.",
    features: ["UX & UI and AI & search scores", "Top 3 critical issues", "SEO & GEO issue list", "Annotated preview of findings"],
    cta: "Start free scan",
    highlighted: false,
  },
  {
    key: "pro",
    name: "Pro",
    price: "$39",
    cadence: "per month",
    description: "Unlimited scans with the full executive report.",
    features: [
      "Unlimited scans every month",
      "Full report with every annotated finding",
      "Every SEO & GEO fix, step by step",
      "Insights: next steps and jobs to be done",
      "PDF, share link and Notion export",
    ],
    cta: "Go Pro",
    highlighted: true,
  },
] as const;

export function labelFor(list: readonly { value: string; label: string }[], value: string) {
  return list.find((o) => o.value === value)?.label ?? value;
}
