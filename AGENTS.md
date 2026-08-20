# AGENTS.md

## Project

Movie discovery and recommendation MVP built with Next.js, TypeScript, Supabase, Drizzle, Zod, TMDB, Motion, and AI SDK.

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
  - description: 10–400 characters
- Reviews do not affect recommendations in V1.
- A movie is excluded from Discover once it has a `LIKE` or `DISLIKE`.
- Onboarding requires at least 2 genres and 3 liked movies.
- Onboarding movies are stored as `LIKE` with `watchedAt = now()`.

## Architecture

Use a modular monolith.

```text
Route / Server Action
        ↓
Application Service
        ↓
Repository / Integration
```

Keep business logic out of React components and route handlers.

Main areas:

```text
src/
  app/
  contracts/
  db/
  features/
  integrations/
  lib/
  fixtures/
```

## Contracts

- Zod schemas are the single source of truth.
- Infer TypeScript types with `z.infer`.
- Do not duplicate contract types manually.
- Frontend and backend must consume the same contracts.
- Validate all external input at boundaries.
- Do not change a shared contract silently; update dependent code in the same PR.

## TMDB

- Access TMDB only through the TMDB integration layer.
- Do not call TMDB directly from React components.
- Keep TMDB naming/details inside the adapter.
- Store image paths, not full TMDB image URLs.
- Use TMDB for catalog/search/discovery metadata, not for user data.
- Do not replicate the full TMDB catalog locally.
- Local movie cache is disposable and never a source of truth.

## Recommendation Engine

MVP uses Content-Based Filtering only.

```text
Preferences + Likes + Dislikes
        ↓
Taste Profile
        ↓
Candidate Generation
        ↓
Local Ranking
        ↓
Discover
```

- TMDB may generate candidates.
- Our application owns the final ranking.
- Do not use TMDB Recommendations as the main recommender.
- Do not add collaborative filtering, embeddings, or pgvector unless explicitly required.

## AI Chat

- Chat is not persisted in the MVP.
- The LLM must use the existing Recommendation Service.
- Do not implement a second recommendation algorithm inside the chat.
- Prefer structured movie references over LLM-invented movie data.

## Database

User-owned data belongs in our database:

- users
- user preferences
- movie interactions
- reviews
- optional movie cache

Enforce important invariants in both Zod and the database when possible.

## Git Workflow

```text
main
  └── develop
        └── feature/*
```

- Never develop directly on `main`.
- Start feature branches from updated `develop`.
- Keep branches short-lived and focused.
- PRs target `develop`.
- `develop` is merged into `main` for stable releases.

Commit style:

```text
feat: ...
fix: ...
refactor: ...
test: ...
docs: ...
chore: ...
```

## Code Quality

Before opening a PR, run:

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

Prefer:

- small modules;
- explicit names;
- simple control flow;
- server-side secrets;
- reusable domain logic;
- tests for recommendation and business rules.

Avoid:

- premature abstractions;
- microservices;
- duplicated types;
- giant route handlers;
- hidden side effects;
- unnecessary dependencies.

## Decision Rule

For the MVP, choose the simplest implementation that satisfies the agreed contracts and preserves a clear path for future evolution.
