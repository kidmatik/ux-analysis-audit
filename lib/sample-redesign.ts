import type { CurrentStyle, Pin, RedesignPlan } from "./redesign";

// The sample report's One-click Redesign, applied to scripts/sample-site by
// scripts/capture-sample-redesign.mts, which writes public/sample/redesign-*.{png,html}
// and prints the pins and current style recorded below.

export const SAMPLE_REDESIGN_PLAN: RedesignPlan = {
  summary:
    "The hero now promises a defensible forecast in seven words, with one primary action and a quiet demo link, set in a bolder type system built on Acme's indigo. Feature cards describe results instead of capabilities.",
  copy: [
    {
      role: "headline",
      before: "The unified, AI-native operational intelligence platform for modern data-driven revenue organizations",
      after: "Forecast revenue you can defend in the boardroom.",
      why: "Names the buyer's outcome in seven words; category language moves out of the hero.",
      findingId: "F1",
    },
    {
      role: "subheadline",
      before:
        "Acme Insights connects your CRM, billing, product analytics, support desk and data warehouse into a single source of truth, with configurable dashboards, automated anomaly detection, forecasting models, granular role-based permissions, and over 120 native integrations so every team can collaborate on shared metrics and make better decisions, faster, across the entire customer lifecycle.",
      after: "Acme connects your CRM, billing and product data, then flags the deals and accounts that will move your number.",
      why: "One 20-word sentence that says how, replacing a 54-word list of features.",
      findingId: "F6",
    },
    {
      role: "primary_cta",
      before: "Get started",
      after: "Start free trial",
      why: "Says what happens next and signals there is no commitment.",
      findingId: "F2",
    },
    {
      role: "secondary_cta",
      before: "Book a demo",
      after: "Or book a 20-minute demo",
      why: "Framed as the alternative, with a time cost, so it supports the primary action instead of competing with it.",
      findingId: "F2",
    },
    {
      role: "section_heading",
      before: "Everything your revenue team needs",
      after: "What changes for your revenue team in week one",
      why: "Turns a feature roundup into a promise the cards then prove.",
      findingId: "F11",
    },
    {
      role: "section_heading",
      before: "Anomaly detection",
      after: "Catch revenue leaks the day they start",
      why: "States the result of the feature, not its name.",
      findingId: "F11",
    },
    {
      role: "section_heading",
      before: "Forecasting",
      after: "Call the quarter with confidence",
      why: "Speaks to the job the revenue leader is hiring the product for.",
      findingId: "F11",
    },
    {
      role: "section_heading",
      before: "Built for scale",
      after: "Grows with you from first dashboard to enterprise",
      why: "A specific promise gets read; a generic one gets skipped.",
      findingId: null,
    },
  ],
  ctas: { primary: "Get started", secondary: "Book a demo", remove: ["Watch video", "Talk to sales"] },
  styleguide: {
    name: "Acme Outcome UI",
    fonts: { heading: "Plus Jakarta Sans", body: "Inter" },
    colors: [
      { role: "primary", name: "Acme Indigo", hex: "#3341c4" },
      { role: "on_primary", name: "On indigo", hex: "#ffffff" },
      { role: "ink", name: "Midnight", hex: "#0f1630" },
      { role: "muted", name: "Slate", hex: "#4a5470" },
      { role: "background", name: "Paper", hex: "#ffffff" },
      { role: "surface", name: "Mist", hex: "#f3f5ff" },
      { role: "accent", name: "Signal amber", hex: "#ffb547" },
      { role: "success", name: "Proof green", hex: "#0f8a5f" },
    ],
    type: [
      { token: "display", size: 64, weight: 800, lineHeight: 1.03, tracking: -0.035 },
      { token: "h2", size: 40, weight: 800, lineHeight: 1.1, tracking: -0.03 },
      { token: "h3", size: 20, weight: 700, lineHeight: 1.3, tracking: -0.01 },
      { token: "body_lg", size: 20, weight: 400, lineHeight: 1.55, tracking: 0 },
      { token: "body", size: 16, weight: 400, lineHeight: 1.65, tracking: 0 },
      { token: "small", size: 14, weight: 500, lineHeight: 1.5, tracking: 0.01 },
      { token: "button", size: 17, weight: 700, lineHeight: 1, tracking: 0 },
    ],
    radius: 12,
    spacing: 8,
    voice: [
      "Lead with the revenue outcome, then say how.",
      "One idea per sentence, under 20 words.",
      "Buttons are verb plus object: Start free trial, not Get started.",
      "Back every claim with a number, a customer or a screenshot.",
      "Say forecast, pipeline and churn, never operational intelligence.",
    ],
  },
  changes: [
    { area: "copy", title: "Outcome-led headline", detail: "“Forecast revenue you can defend in the boardroom.” replaces a 13-word category description.", findingId: "F1" },
    { area: "typography", title: "Bolder, larger headline", detail: "The headline moves from 44px / 700 to 64px / 800 in Plus Jakarta Sans with tighter tracking, so it is the first thing the eye lands on.", findingId: "F1" },
    { area: "cta", title: "Hero actions cut from 4 to 2", detail: "“Watch video” and “Talk to sales” leave the hero. “Start free trial” is the single filled button, and the demo is a text link.", findingId: "F2" },
    { area: "hierarchy", title: "Hero copy cut from 54 to 20 words", detail: "The supporting paragraph becomes one sentence at 20px with a 34em line length.", findingId: "F6" },
    { area: "copy", title: "Feature cards sell results", detail: "Section and card headings describe what changes for the team, not the feature name.", findingId: "F11" },
    { area: "contrast", title: "Accessible brand indigo", detail: "Primary deepens from #3b4cca to #3341c4 so white button text clears WCAG AA with room to spare (7.4:1).", findingId: null },
    { area: "spacing", title: "Consistent rhythm", detail: "Buttons and cards share a 12px radius and an 8px spacing grid.", findingId: null },
  ],
  projectedScore: 74,
};

// Recorded by scripts/capture-sample-redesign.mts.
export const SAMPLE_REDESIGN_HEIGHT = 1274;
export const SAMPLE_REDESIGN_PINS: Pin[] = [{"copyIndex":0,"x":3.3,"y":11.9,"w":46.1,"h":15.5},{"copyIndex":1,"x":3.3,"y":28.9,"w":47.1,"h":4.9},{"copyIndex":2,"x":3.3,"y":35.9,"w":11.8,"h":4.4},{"copyIndex":3,"x":15.9,"y":35.9,"w":15.1,"h":4.4},{"copyIndex":4,"x":3.3,"y":49.7,"w":93.3,"h":3.5},{"copyIndex":5,"x":36.8,"y":57.4,"w":26.3,"h":2},{"copyIndex":6,"x":68.6,"y":57.4,"w":26.3,"h":2},{"copyIndex":7,"x":3.3,"y":87.2,"w":93.3,"h":3.5}];
export const SAMPLE_REDESIGN_CURRENT: CurrentStyle = {"headingFont": "-apple-system", "bodyFont": "-apple-system", "h1": {"size": 44, "weight": 700, "lineHeight": 1.15, "color": "rgb(29, 36, 51)"}, "body": {"size": 16, "lineHeight": 1.5, "color": "rgb(29, 36, 51)", "background": "rgb(255, 255, 255)"}, "buttons": [{"text": "Log in", "background": "rgb(238, 240, 251)", "color": "rgb(59, 76, 202)", "radius": 8}, {"text": "Get started", "background": "rgb(59, 76, 202)", "color": "rgb(255, 255, 255)", "radius": 8}, {"text": "Get started", "background": "rgb(59, 76, 202)", "color": "rgb(255, 255, 255)", "radius": 8}, {"text": "Book a demo", "background": "rgb(29, 36, 51)", "color": "rgb(255, 255, 255)", "radius": 8}, {"text": "Watch video", "background": "rgb(244, 166, 42)", "color": "rgb(29, 36, 51)", "radius": 8}, {"text": "Talk to sales", "background": "rgb(238, 240, 251)", "color": "rgb(59, 76, 202)", "radius": 8}], "heroParagraph": "Acme Insights connects your CRM, billing, product analytics, support desk and data warehouse into a single source of truth, with configurable dashboards, automated anomaly detection, forecasting models, granular role-based permissions, and over 120 native integrations so every team can collaborate on shared metrics and make better decisions, faster, across the entire customer lifecycle.", "headings": ["Everything your revenue team needs", "Unified data layer", "Anomaly detection", "Forecasting", "Dashboards", "Permissions", "Integrations", "Built for scale"]};
