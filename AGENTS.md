# LifeUpgrade Agent Instructions

LifeUpgrade is a hackathon MVP web app that recommends high-impact product upgrades based on what a user currently owns, their problems, constraints, budget, preferences, and optional room photos.

## Product Goal

Build a clean, modular, demo-ready web app that helps users identify worthwhile upgrades for their current setup. Recommendations should be explainable, practical, and grounded in deterministic scoring rather than vague AI-only logic.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite for the local MVP
- No unnecessary backend services unless explicitly requested

## Engineering Standards

- Use TypeScript everywhere.
- Keep code clean, modular, and easy to demo.
- Prefer deterministic scoring functions over opaque AI-only decision logic.
- Keep all recommendation scoring in pure functions under `/lib/recommendation`.
- Add succinct comments for non-obvious scoring logic.
- Keep product catalog seed data under `/data/productCatalog.ts` or `/data/productCatalog.json`.
- Keep availability integrations under `/lib/availability`.
- Use mock availability first.
- Build availability behind a provider interface so eBay, Amazon, or other APIs can be added later.
- Do not store sensitive profile fields in `localStorage`.
- Add privacy controls for editing profile, deleting profile, and deleting inventory.
- Keep UI simple, polished, and suitable for a hackathon demo.

## MVP Scope

### 1. User Profile Onboarding

Capture:

- Age range
- Profession
- Budget
- Wealth/spending style
- Preferences
- Problems
- Accessibility needs
- Desk and room constraints

### 2. Inventory

- Support manual item entry first.
- Treat image upload as optional later scope.

### 3. Recommendation Engine

- Detect life and product gaps.
- Rank categories.
- Rank specific product models.
- Explain every recommendation.
- Keep scoring pure and testable under `/lib/recommendation`.

### 4. Product Catalog

Include seed products for:

- Monitors
- Laptop stands
- Keyboards
- Mice
- Chairs
- Lamps
- Headphones
- Webcams

### 5. Availability

- Start with mock availability.
- Define a provider interface before adding live integrations.
- Keep live providers pluggable and isolated under `/lib/availability`.

### 6. Demo

- Include seed examples.
- Include a one-click demo profile.

## Validation

After each major change:

- Run typecheck if available.
- Run lint if available.
- Keep changes small.
- Explain what changed and note any validation that could not be run.

## Implementation Preferences

- Favor small, focused modules over large mixed-purpose files.
- Keep business logic out of UI components where practical.
- Use server actions or API routes only when they simplify the MVP.
- Keep Prisma schema and seed data easy to inspect during demos.
- Prefer straightforward, readable scoring weights that can be explained to judges and users.
- Avoid adding external services, background jobs, queues, or auth unless requested.
