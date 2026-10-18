export type ElementKind = "headline" | "subheadline" | "cta" | "nav" | "form" | "input" | "text" | "image" | "social_proof" | "pricing" | "frame";

export type DetectedElement = {
  kind: ElementKind;
  text: string;
  // Percent of the screenshot (0-100)
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Screen = {
  assetId: string;
  label: string;
  width: number;
  height: number;
  path: string;
  mimeType: string;
  elements: DetectedElement[];
  pageUrl?: string;
};

export type PageSignals = {
  url: string;
  title: string;
  metaDescription: string;
  h1: string[];
  headings: string[];
  ctas: string[];
  aboveFoldCtas: string[];
  navItems: string[];
  wordCount: number;
  aboveFoldWords: number;
  formFields: number;
  hasPricingLink: boolean;
  hasTestimonials: boolean;
  hasLogoWall: boolean;
  hasSecuritySignals: boolean;
  hasNumbersProof: boolean;
  hasDemoOrTrial: boolean;
  imageCount: number;
  loadMs: number;
};

export type CaptureResult = {
  screens: Screen[];
  signals: PageSignals[];
  notes: string[];
};
