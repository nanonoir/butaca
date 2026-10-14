# AGENTS.md

## Project

Movie discovery and recommendation MVP built with Next.js, TypeScript, Supabase (Auth + PostgreSQL), Drizzle, Zod, TMDB, Motion, and AI SDK.

## Stack Summary

- **Runtime & Framework**: Next.js 16.3.1 (React 19.2.8, React Compiler)
- **Language**: TypeScript 5 (Strict mode)
- **Styling & UI**: Tailwind CSS 4, Motion (`motion` 13.1.0), clsx, tailwind-merge
- **Database & Persistence**: Supabase PostgreSQL, Drizzle ORM 0.45.2, `postgres` driver, Drizzle Kit 0.31.10
- **Validation & Contracts**: Zod 4.4.3 (`src/contracts/` is single source of truth; types derived with `z.infer`)
- **External Integrations**: TMDB API (movie catalog & metadata), Supabase Auth (`@supabase/ssr`, `@supabase/supabase-js`)
- **AI**: AI SDK (`ai` 7.0.66, `@ai-sdk/google` 4.0.49, `@ai-sdk/react` 4.0.69)
- **Quality & Testing**: Vitest 4.1.10, Testing Library React 16.3.2, Playwright 1.62.1, ESLint 9, Prettier 3.9.6
- **Package Manager**: pnpm 11.13.1

## Core Product Rules

- Movies only; no TV shows in the MVP.
- TMDB is the canonical movie catalog and its movie IDs are used directly.
- `LIKE` and `DISLIKE` are the only persisted movie reactions.
- `watchedAt` is independent from the reaction: it may exist with `LIKE`, `DISLIKE`, or no reaction.
- Switching or removing a reaction must preserve `watchedAt`.
- The user's "Liked Movies" list is derived from `reaction = LIKE`.
- No watchlist.
- Reviews contain:
  - `RECOMMENDED` or `NOT_WORTH_IT`
  - title: 3–30 characters
  - description: 3–400 characters
- Reviews do not affect recommendations in V1.
- A movie is excluded from Discover once it has a `LIKE` or `DISLIKE`.
- Onboarding requires at least 2 genres (max 8) and 3 liked movies (max 8).
- Onboarding movies are stored as `LIKE` with `watchedAt = now()`.

## Architecture & Structure

Modular monolith:

```text
Route / Server Action
        ↓
Application Service
        ↓
Repository / Integration
```

- Keep business logic out of React components and route handlers.
- Never accept `userId` from client requests; resolve identity server-side via `AuthService.getCurrentUser()` (Supabase `getClaims()`, never `getSession()`).
- Access TMDB only via `src/integrations/tmdb/`.
- Local movie cache (`movie_cache`) is disposable with a 24-hour TTL and is never a source of truth.
- Recommendation engine uses Content-Based Filtering only. TMDB generates candidates; Butaca owns ranking.
- AI Chat is ephemeral in MVP and uses the existing recommendation service.

### Directory Map

```text
src/
  app/            # App Router pages, layouts, route handlers
  components/     # Reusable UI primitives (ui/) and shell layout (shared/)
  contracts/      # Shared Zod schemas and inferred types
  db/             # Drizzle schemas, migrations, client, and repositories
  features/       # Domain modules (auth, discovery, recommendations, onboarding, movies, profile, likes, reviews)
  fixtures/       # Development and test fixtures
  integrations/   # TMDB adapter/client, Supabase clients and session proxy
  lib/            # Shared utilities (environment parsers, route helpers)
```

## Documentation Map

- **Architecture Details**: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- **Product Specifications**: [`docs/product-specs/index.md`](./docs/product-specs/index.md)
  - Contracts: [`docs/product-specs/contracts.md`](./docs/product-specs/contracts.md)
  - UI Foundation: [`docs/product-specs/ui-foundation.md`](./docs/product-specs/ui-foundation.md)
  - Authentication: [`docs/product-specs/auth-flow.md`](./docs/product-specs/auth-flow.md)
  - Onboarding: [`docs/product-specs/onboarding.md`](./docs/product-specs/onboarding.md)
  - Movie Catalog: [`docs/product-specs/movie-catalog-completion.md`](./docs/product-specs/movie-catalog-completion.md)
  - Discover & Onboarding Flow: [`docs/product-specs/discover-onboarding-frontend.md`](./docs/product-specs/discover-onboarding-frontend.md)
- **Technical Design Docs**: [`docs/design-docs/index.md`](./docs/design-docs/index.md)
  - Foundation Backend: [`docs/design-docs/foundation-backend.md`](./docs/design-docs/foundation-backend.md)
  - Profile Screen & Session: [`docs/design-docs/profile-screen.md`](./docs/design-docs/profile-screen.md)
  - About Page & Attribution: [`docs/design-docs/about-page.md`](./docs/design-docs/about-page.md)
- **Execution Plans (ExecPlans)**:
  - Protocol: [`docs/PLANS.md`](./docs/PLANS.md)
  - Active: `docs/exec-plans/active/`
  - Completed: `docs/exec-plans/completed/`
  - Technical Debt: [`docs/exec-plans/tech-debt-tracker.md`](./docs/exec-plans/tech-debt-tracker.md)
- **References & Operations**: [`docs/references/index.md`](./docs/references/index.md)
  - Backend Operations: [`docs/references/foundation-backend-ops.md`](./docs/references/foundation-backend-ops.md)
  - Docker Deployment: [`docs/references/docker-deployment.md`](./docs/references/docker-deployment.md)

## Development & Verification Commands

```bash
pnpm dev              # Development server
pnpm lint             # ESLint checks
pnpm typecheck        # Strict TypeScript type check (next typegen && tsc --noEmit)
pnpm test:run         # Unit test suite with Vitest
pnpm build            # Production Next.js build
pnpm test:integration # Integration tests against Supabase & TMDB
pnpm test:e2e         # End-to-end tests with Playwright
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Apply pending migrations
pnpm db:check         # Validate migration journal
```

## Quality Invariants

Before opening a PR, always run:

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```
