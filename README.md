# UX Analysis Audit

AI-powered product and onboarding audit platform for SaaS startups. A user provides access to a website, landing page or product (live URL, demo login, Figma file, guided screen recording, or uploaded screenshots and video), and the app produces an executive growth report: a 0–100 Growth Readiness Score, the top three critical issues, detailed findings with an annotated screenshot next to each one, visual annotations and a prioritized action plan.

Powered by Matan.Design.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS 4
- Prisma + SQLite (swap the datasource in `prisma/schema.prisma` for Postgres in production)
- NextAuth: Google and email/password
- Playwright (`playwright-core`) for screen capture of live URLs and demo accounts
- Claude API (`claude-opus-5-5`, structured output) for analysis, with a deterministic heuristic engine as fallback
- `@react-pdf/renderer` for server-side PDF export

## Run locally

```bash
npm install
cp .env.example .env          # then fill in the values you have
npx prisma db push            # creates prisma/dev.db
npm run dev                   # http://localhost:3000
```

Everything works without any API keys: without `ANTHROPIC_API_KEY` the heuristic engine runs, without Google keys the Google button is disabled, and without Stripe keys "Go Pro" activates Pro instantly in development (set `ALLOW_DEMO_UPGRADE=true` to allow that under `next start`).

Live URL and demo-account capture need a Chromium binary. Set `CHROMIUM_PATH`, or install one with `npx playwright install chromium` and point `CHROMIUM_PATH` at it.

## Deploy

The app needs a long-running Node server with Chromium and a persistent disk (SQLite plus captured screens), so use a container host rather than serverless.

- **Render**: push this repo to GitHub, then New, Blueprint, and pick the repo. `render.yaml` builds the `Dockerfile` on the free plan and generates the secrets (free instances sleep when idle and reset their data on restart; switch to `starter` and enable the disk for production). Set `NEXTAUTH_URL` to the service URL once it exists.
- **Railway / Fly.io / any Docker host**: build the `Dockerfile`, mount a volume at `/data`, and set `NEXTAUTH_URL`, `NEXTAUTH_SECRET` and `CREDENTIALS_ENCRYPTION_KEY`.

`ALLOW_DEMO_UPGRADE=true` lets testers try Pro without Stripe; remove it once Stripe keys are set.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma connection string |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | NextAuth |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in (callback: `/api/auth/callback/google`) |
| `CREDENTIALS_ENCRYPTION_KEY` | AES-256-GCM key for temporary demo passwords and Figma tokens (falls back to `NEXTAUTH_SECRET`) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Claude analysis engine (default model `claude-opus-5-5`) |
| `CHROMIUM_PATH` | Chromium used for capture |
| `CAPTURE_PROXY` | Optional proxy for the capture browser |
| `FIGMA_TOKEN` | Optional server-wide Figma token (users can also paste their own) |
| `STORAGE_DIR` | Where uploads and captures are written (default `./data/uploads`) |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | Pro subscription ($39/month). Webhook: `/api/billing/webhook` (`checkout.session.completed`, `customer.subscription.deleted`) |
| `ALLOW_DEMO_UPGRADE` | `true` lets "Go Pro" activate Pro without payment when Stripe is not configured |
| `HUMAN_AUDIT_URL`, `STRATEGY_CALL_URL` | Optional links for the report's bottom CTAs. Without them the CTAs open a request form stored in the `Lead` table |

## Plans

- **Free**: the first scan only, shown as a teaser report (score, sub-scores, top 3 issues with their annotated screens, finding titles). Fixes, full finding detail, the action plan and exports are removed on the server before the page renders.
- **Pro, $39/month**: unlimited scans and the full report, including the action plan, PDF, Notion export and every annotated screen.

Gating lives in `lib/gate.ts`; pricing copy in `lib/config.ts`.

## How an audit runs

`POST /api/audits` stores the audit (secrets encrypted) and starts `runAudit` in the background (`lib/engine/pipeline.ts`). The processing screen polls `GET /api/audits/:id`.

1. **Capturing screens**: `lib/engine/capture.ts` (live URL: desktop sections, up to two key linked pages such as pricing or signup, and a mobile view; demo account: login, signed-in screens and primary navigation), `lib/engine/figma.ts` (top-level frames via the Figma REST API), or the uploaded images and frames extracted in the browser from videos and screen recordings. Each capture records the boxes of headlines, CTAs, navigation, forms and copy.
2. **Credentials are deleted** as soon as capture finishes (and on failure).
3. **Analysis**: `lib/engine/claude.ts` sends every screenshot plus the detected element boxes and page signals to Claude and receives a typed report (`lib/report.ts`), each finding pinned to a box on a screenshot. If no key is set or the call fails, `lib/engine/heuristic.ts` produces the report from the captured DOM signals.
4. **Scoring and plan**: the Growth Readiness Score is the weighted average of six sub-scores (value proposition 22%, onboarding 20%, conversion 18%, cognitive load 14%, hierarchy 13%, trust 13%). The action plan is derived from each finding's impact and effort.

## Exports

- PDF: `GET /api/audits/:id/pdf` (annotated screenshots next to each finding, Matan.Design footer on every page)
- Share link: `POST /api/audits/:id/share` returns `/r/<token>`; `DELETE` revokes it
- Notion: `GET /api/audits/:id/notion` downloads Markdown that Notion imports directly (Settings, Import, Markdown)

## Sample report

`/sample` shows a full report for a fictional product, "Acme Insights". The pages live in `scripts/sample-site`; `node scripts/capture-sample.mjs` regenerates the screenshots in `public/sample`. The report content is in `lib/sample.ts`.

## Smoke test

With the app on port 3000 and `python3 -m http.server 8090` running inside `scripts/sample-site`:

```bash
node scripts/e2e.mjs        # signup, live URL scan, teaser, upgrade, PDF, Notion, share link, upload scan
node scripts/e2e-demo.mjs   # demo-account capture and credential purge
```

Screenshots and exports are written to `/tmp/claude-0/e2e` (edit `OUT` in the script).
