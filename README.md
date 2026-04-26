# LifeUpgrade

## Project Pitch

LifeUpgrade is a hackathon MVP that recommends the next product upgrade most likely to remove friction from a user's life.

Most shopping flows start with a search query. LifeUpgrade starts with context: what the user already owns, what hurts, what slows them down, what their room allows, and what they can spend. The app then ranks upgrade categories and specific product models with deterministic scoring, so the recommendation can be explained to users and judges without relying on a black-box answer.

Closing pitch:

> LifeUpgrade does not recommend what you search for. It recommends what would remove friction from your life.

## Features

- Landing page demo flow with a one-click laptop-only student scenario.
- Multi-step onboarding for profession, age range, budget, spending style, preferences, problems, ports, and room constraints.
- Manual inventory entry with product model autocomplete and imported catalog specs.
- Browser-side video scan review that turns local object detections into editable inventory estimates.
- Deterministic category and product recommendations with score breakdowns, tradeoffs, and rejection reasoning.
- Price-aware ranking that can move products up or down based on cached or fresh availability snapshots.
- Available-only, under-budget, quiet-product, and small-space filters.
- Watchlist actions and in-app alerts for price drops, target-price hits, score jumps, and top-3 movement.
- Admin quota dashboard for PricesAPI usage, refresh controls, and recent job summaries.
- Admin catalog review surface for searching static models and reviewing manual JSON imports.
- Optional hosted Gemma 4 narrator through the Gemini API, with cached on-demand explanations while deterministic scores remain the source of truth.
- Settings controls for editing profile data, deleting the profile, and deleting inventory.

## Architecture

LifeUpgrade uses Next.js App Router, TypeScript, Tailwind CSS, Prisma, and SQLite.

- `app/`: Route handlers, pages, server actions, cron endpoint, and admin surfaces.
- `components/`: Reusable UI components, onboarding flow, video scan UI, recommendation cards, autocomplete, and shared controls.
- `data/productCatalog.ts`: Seed recommendation catalog and autocomplete catalog products.
- `lib/recommendation/`: Pure deterministic category scoring, product scoring, dashboard helpers, rejection explanations, demo mode, and watchlist alert rules.
- `lib/availability/`: Provider interface, mock provider, PricesAPI.io provider, offer matching, cached summaries, and display helpers.
- `lib/quota/`: PricesAPI policy, usage snapshots, quota reservations, and dashboard metrics.
- `lib/jobs/`: Refresh product selection, price refresh job, recommendation reranking, and watchlist alert creation.
- `lib/catalog/`: Model search, spec normalization, ingestion pipeline, and pluggable catalog providers.
- `lib/vision/`: Frame sampling, TensorFlow.js COCO-SSD provider, scan aggregation, style signals, and dimension estimates.
- `lib/llm/`: Gemma provider, prompt templates, deterministic fallback narrator, and training data export helpers.
- `prisma/schema.prisma`: Profiles, inventory, recommendations, saved products, alerts, availability snapshots, API usage, refresh policies, recent views, job runs, and training examples.

PricesAPI.io calls are intentionally isolated to server-side availability and background job modules. React components and page renders read cached `AvailabilitySnapshot` rows and never call PricesAPI directly.

## Recommendation Design

Category scoring identifies which upgrade type matters first. It considers missing inventory, weak current items, selected problems, room constraints, profession, budget pressure, and normalized specs from imported inventory.

Product scoring lives in `lib/recommendation/productEngine.ts` and uses:

```text
finalScore =
  problemFit * 0.30 +
  constraintFit * 0.20 +
  valueFit * 0.25 +
  compatibilityFit * 0.10 +
  availabilityFit * 0.10 +
  confidence * 0.05
```

The LLM narrator never changes these scores. It only receives the deterministic score, breakdown, reasons, availability state, and rejected alternatives so it can explain them.

## Video Scan Design

The scan flow is a browser-side estimate, not ground truth.

- `components/VideoScanner.tsx` requests camera access and samples frames locally.
- `lib/vision/tfjsCocoProvider.ts` runs COCO-SSD in the browser.
- `lib/vision/scanAggregator.ts` combines repeated detections into suggested inventory.
- `components/ScanReview.tsx` shows confidence, count estimates, size estimates, and editable suggestions.
- Only approved scan items are saved to SQLite.

The UI repeatedly states that video detections are estimates. Exact brand, model, and specs are added or corrected in manual inventory.

## Product Catalog Design

The MVP uses a seed catalog in `data/productCatalog.ts`.

- Recommendation products include category, brand, model, price, problem coverage, constraints, scoring hints, identifiers, and search queries.
- Autocomplete products include normalized specs such as laptop RAM, ports, monitor resolution, mouse ergonomics, keyboard noise, and chair support.
- Inventory stores `catalogProductId` and `specsJson` when a user selects an autocomplete match.
- Recommendation scoring reads imported specs through pure functions in `lib/catalog/specNormalizer.ts`.
- Admin catalog review supports static search and manual JSON import review without writing directly into the seed file.

Live catalog providers are intentionally pluggable and isolated under `lib/catalog/providers/`.

## PricesAPI.io Integration

LifeUpgrade uses PricesAPI.io as a background-only price source.

- Base URL: `https://api.pricesapi.io`
- Product search: `GET /api/v1/products/search?q={query}&limit=10`
- Offers lookup: `GET /api/v1/products/{id}/offers?country={country}`
- Auth header: `x-api-key: {PRICES_API_KEY}`

The offers endpoint can take 5-30 seconds, so it is never called from React components or page render. `refreshPrices()` performs search and offers lookups in the background, writes normalized `AvailabilitySnapshot` rows, and recommendation pages use those cached rows. Recommendation runs are cache-only by default; `AUTO_REFRESH_TOP_RECOMMENDATION_PRICE=true` may refresh only the current #1 recommendation when no fresh cache exists and quota is healthy.

## PricesAPI Free-Tier Policy

The PricesAPI free tier is treated as a scarce budget.

- Monthly hard limit: `950` calls.
- Daily soft cap: `30` automatic refresh calls.
- Minute hard limit: `8` calls.
- Reserve: `50` monthly calls are held back from a 1,000-call plan.

Quota enforcement rules:

- Server code calls `canUsePricesApi()` before refresh attempts.
- Actual PricesAPI calls reserve quota through `reservePricesApiCall()` before network fetch.
- In-process reservations are serialized so concurrent server calls cannot bypass the local quota gate.
- Failed provider requests still count against quota once reserved.
- If quota is exhausted, the app shows cached prices with a `PricesAPI quota-limited` badge instead of treating the state as a user-facing error.
- The `available only` filter hides unavailable products and keeps unknown availability out of that filtered view.

Cached price cards show both a status and a last-checked timestamp, for example `Cached price from PricesAPI` and `Last checked Apr 25, 12:00 PM PDT (2 hours ago)`.

## Background Job Policy

Background jobs are conservative by default.

- `selectProductsForRefresh()` picks watchlisted products with target prices first, then top recommendations, then recently viewed products.
- The refresh job does not perform full-catalog crawling on the free tier.
- Watchlisted products refresh at most every 12 hours.
- Top recommendations and recently viewed products refresh at most daily.
- `refreshPrices()` records a `JobRun`, reranks saved recommendations, and creates watchlist alerts.
- The Vercel cron route is protected by `CRON_SECRET`.
- Quota-limited refresh skips are expected states and appear in the admin dashboard.

The included `vercel.json` schedules `/api/cron/refresh-prices` every 6 hours, but local demo mode can use the admin dashboard's `Run refresh now` button.

## Gemma Narrator Design

Gemma is optional and does not require fine-tuning. LifeUpgrade uses hosted Gemma 4 through the Gemini API with `GEMINI_MODEL=gemma-4-26b-a4b-it` by default. If `GEMINI_API_KEY` is not set, Gemini is unavailable, the daily soft cap is exhausted, or the response fails validation, LifeUpgrade falls back to deterministic explanation copy.

Recommendation pages do not call Gemini during render. They read `RecommendationExplanationCache` rows keyed by `recommendationId + productId + inputHash`; if no cache entry exists, the UI shows deterministic fallback copy. Gemini is called only from explicit generate or refresh actions, then the result is stored for future page renders.

Guardrails:

- Gemma receives deterministic recommendation inputs and score breakdowns.
- Gemma can only provide `headline`, `explanation`, `whyThisHelps`, `tradeoffs`, `whyNotCheaper`, `whyNotMoreExpensive`, `confidenceNote`, and `followUpQuestion`.
- Gemma output is validated with a strict Zod JSON schema before display.
- Fallback copy is used when output is invalid.
- Fallback copy is used when Gemini errors, rate-limits, or the configured daily soft cap is exhausted.
- `GEMINI_DAILY_SOFT_CAP` defaults to `200` and blocks additional on-demand refreshes after the cap is reached.
- Unavailable products are not described as currently available.
- Quota-limited cached prices are called out in the confidence note.
- Numeric scores, ranking, budget logic, and availability states are never changed by the LLM.
- Recommendation UI shows whether each explanation came from cached Gemma output or deterministic fallback.
- The admin dashboard shows Gemini calls today, cached hits, failures, and fallback count.

Hosted API limits:

- The free Gemini API tier is limited and should be treated as demo capacity, not unlimited production capacity.
- A paid tier gives higher rate limits and more predictable headroom, but it is still governed by quotas, rate limits, and billing controls.
- There is no truly unlimited hosted API for Gemma or Gemini usage.
- Self-hosting Gemma removes hosted API quotas, but it requires enough local or cloud hardware, deployment work, monitoring, and operational budget.

Fine-tuning is a future improvement, not a requirement. Training examples can be exported from the admin training-data page for a later LoRA workflow, but the app is designed to run today with a base Gemma endpoint.

## Environment Variables

Required:

```bash
DATABASE_URL="file:./dev.db"
MONGODB_URI="mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/lifeupgrade"
MONGODB_DB_NAME="lifeupgrade"
```

Optional:

```bash
AVAILABILITY_PROVIDER="mock"
DEV_USER_ID="dev-user"
CRON_SECRET="replace-me"
PRICES_API_BASE_URL="https://api.pricesapi.io"
PRICES_API_KEY="replace-me"
PRICES_API_COUNTRY="us"
AUTO_REFRESH_TOP_RECOMMENDATION_PRICE="false"
GEMINI_API_KEY="replace-me"
GEMINI_MODEL="gemma-4-26b-a4b-it"
GEMINI_DAILY_SOFT_CAP="200"
```

Inventory is currently backed by MongoDB collections named `users` and `inventory_items`. Until real auth is added,
server code uses the temporary `DEV_USER_ID` value for every inventory item and creates that dev user automatically.
For local-only testing, `MONGODB_URI="mongodb://localhost:27017/lifeupgrade"` also works. For Atlas, use the Atlas
connection string and make sure the local IP is allowed in Network Access.

`AVAILABILITY_PROVIDER` defaults to `mock`. Use `pricesapi` only when `PRICES_API_KEY` is configured. `PRICES_API_BASE_URL` defaults to `https://api.pricesapi.io`, and the old `PRICE_API_*` env vars still work as temporary fallbacks. If the PricesAPI provider is selected without credentials, LifeUpgrade falls back to mock availability. `AUTO_REFRESH_TOP_RECOMMENDATION_PRICE` defaults to `false`; when enabled it still checks the fresh cache, monthly reserve, and minute quota before a live lookup.

`GEMINI_API_KEY` enables hosted Gemma 4 narration through the Gemini API. `GEMINI_MODEL` defaults to `gemma-4-26b-a4b-it`, and `GEMINI_DAILY_SOFT_CAP` defaults to `200`. The admin dashboard includes a `Test Gemma explanation` button that generates or refreshes a cached demo recommendation explanation and reports whether Gemini or deterministic fallback handled it.

## MongoDB Migration Setup

Required env vars:

```bash
DATABASE_URL="file:./dev.db"
MONGODB_URI="mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/lifeupgrade"
MONGODB_DB_NAME="lifeupgrade"
DEV_USER_ID="dev-user"
```

Set up MongoDB indexes:

```bash
npm run db:setup-indexes
```

Seed or update the MongoDB device catalog:

```bash
npm run db:seed-devices
```

Migrate SQLite, hardcoded demo, and detected JSON inventory/profile data into MongoDB:

```bash
npm run db:migrate-inventory
```

Start the app:

```bash
npm run dev
```

Run the manual MongoDB migration verifier from a second terminal while the app is running:

```bash
APP_BASE_URL="http://localhost:3000" npm run verify:mongodb-migration
```

The verifier checks Atlas connectivity, index creation, device seed insert/update behavior, inventory migration
insert/update behavior, `/api/devices`, current-user inventory scoping, inventory POST/PATCH/DELETE, and a
MongoDB-backed recommendation ranking.

## How To Run Locally

Install dependencies:

```bash
npm install
```

Create and initialize the local database:

```bash
npm run db:init
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`, or the alternate port printed by Next.js.

Useful validation commands:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Run the price refresh job locally:

```bash
npm run job:refresh-prices
```

## How To Run Demo Mode

Fastest landing-page demo:

1. Start the app.
2. Open `/`.
3. Click `Run demo mode`.
4. Open `/recommendations`.
5. Run a mock price refresh from `/admin/api-usage` to trigger the seeded watchlist price-drop alert.
6. Open `/alerts`.

Full walkthrough:

1. Open `/scan` and run or describe the local video scan.
2. Review the estimated detections and save approved inventory.
3. Open `/inventory`.
4. Use product autocomplete to select an exact laptop and mouse.
5. Confirm imported specs appear on the saved inventory cards.
6. Open `/onboarding` or use demo onboarding to set neck pain, eye strain, low productivity, and a `$300` budget.
7. Open `/recommendations`.
8. Show laptop stand and monitor ranked above a new laptop.
9. Show cached or fresh prices with last-checked timestamps.
10. Show the watchlist alert after the price refresh.

## Known Limitations

- Availability is mocked by default. Live prices require PricesAPI credentials.
- The browser video scan uses COCO-SSD estimates and does not identify exact product models.
- Admin catalog approval is an in-session review surface; it does not rewrite `data/productCatalog.ts`.
- There is no authentication. The MVP uses a local demo profile in SQLite.
- Email and push notification delivery are not implemented; alerts are in-app only.
- Vercel Hobby cron may not be reliable for frequent refreshes.
- PricesAPI quota is enforced per app process and persisted through SQLite counters, but a multi-region production deployment would need a centralized quota lock.
- Gemma narration is optional and does not replace deterministic scoring.
