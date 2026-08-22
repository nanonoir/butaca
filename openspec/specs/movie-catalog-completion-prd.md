# PRD — Movie Catalog Completion

## Overview

**Feature:** Movie Catalog Completion  
**Status:** Refined — Ready for SDD  
**Scope:** Inline movie search in Discover, catalog service completion, Similar Movies, and integration with the existing movie-detail modal  
**Out of scope:** Discovery recommendation wiring or redesign, TMDB cache changes, movie-detail permalink routes, onboarding and route guards, reactions, watched state, reviews, database migrations

Butaca already has the shared contracts, TMDB integration, cache, API conventions, movie-detail API, and movie-detail modal needed for this work. The remaining catalog work is narrower than the original draft: expose the existing TMDB search and similar-movie capabilities through application services and Route Handlers, add submit-only search to Discover, and add similar movies to the existing detail modal.

This PRD is the product and repository-aligned source of truth for downstream proposal, specification, design, tasks, implementation, and verification.

---

## Product Decisions

The following decisions are locked for this change:

| Topic | Decision |
|---|---|
| Search location | Search is embedded in the existing Discover screen. There is no separate `/search` page and no new primary navigation item. |
| Search trigger | Search runs only after explicit submission through Enter or the search button. Typing MUST NOT trigger API requests. |
| Search presentation | Submitted results replace the normal Discover recommendation experience with a movie grid. |
| Search exit | Clearing or closing search restores the normal Discover experience. |
| Search pagination | Numbered pagination only. No infinite scroll and no load-more control. |
| Page size | Reuse the existing `PAGE_SIZE = 20` contract. |
| Movie detail navigation | Search and Similar Movies open the existing `MovieDetailScreen` modal. No `/movies/[movieId]` page is added. |
| Detail API shape | Preserve the existing aggregate `MovieDetailPageData` response. Do not split the endpoint in this change. |
| Feature boundaries | Keep `src/features/movie-detail/` in place. Populate `src/features/movies/` with reusable search and similar-movie catalog logic; do not move existing detail code merely to satisfy a folder preference. |
| Onboarding gate | Explicitly excluded. The incomplete onboarding guard is documented as separate Auth/Onboarding work. |
| Database | No migrations are required. |

---

## Objectives

Users must be able to:

- search TMDB movies from Discover without requests being sent while typing;
- inspect search results in a responsive grid;
- navigate explicitly between numbered result pages;
- open any search result in the existing movie-detail modal;
- browse similar movies from the detail modal;
- open a similar movie in the same modal experience;
- return from search mode to the normal Discover experience by clearing or closing the search.

The implementation must reuse the repository's current contracts, TMDB adapter, cache, API helpers, visual foundation, and movie-detail composition.

---

## Codebase Alignment and Invariants

### Verified repository state

| Area | Current state |
|---|---|
| Shared API foundation | Implemented in `src/lib/api/route.ts` and already merged into `develop` |
| TMDB integration | Search, detail, and similar methods already exist in `TmdbAdapter` and `TmdbClient` |
| TMDB detail cache | Implemented through `MovieCacheRepository`; only movie detail uses the cache |
| Shared contracts | Movie, search, detail, page-query, and pagination schemas already exist |
| Movie detail API | Implemented at `src/app/api/movies/[movieId]/route.ts` |
| Movie detail application layer | Implemented under `src/features/movie-detail/` |
| Movie detail UI | Implemented as `MovieDetailScreen`, opened as a modal/overlay |
| Search API route | Missing |
| Search UI | Missing |
| Similar Movies API route | Missing |
| Similar Movies UI | Missing |
| `src/features/movies/` | Empty except for `.gitkeep` |
| Discover | UI is implemented but currently receives fixture data; recommendation wiring is separate work |
| Onboarding guard | Auth guard exists but does not enforce onboarding completion; excluded from this change |
| Database schema | Already sufficient; no catalog migration is needed |

### Architectural invariants

```text
Route Handler / React Surface
        ↓
Catalog Application Service
        ↓
TMDB Integration
        ↓
TMDB API or existing detail cache behavior
```

- Zod schemas remain the single source of truth.
- TypeScript types must be inferred from shared schemas.
- React components must not call TMDB directly.
- Route Handlers must not contain catalog orchestration or TMDB mapping logic.
- Frontend code must not receive raw TMDB payloads.
- The existing TMDB cache must not be rewritten, duplicated, or bypassed.
- Search and Similar Movies must use the existing TMDB integration methods.
- The existing movie-detail endpoint and aggregate response must remain compatible with interactions and reviews.
- Catalog work must not alter reaction, watched-state, or review behavior.
- Personalized Discover and catalog Similar Movies are separate concepts.

---

## Existing Assets to Reuse

### Contracts

```text
src/contracts/common.ts
  PAGE_SIZE
  PageQuerySchema
  PaginationMetaSchema
  MovieRouteParamsSchema
  paginatedResponseSchema
  apiDataResponseSchema

src/contracts/movies.ts
  MovieSummarySchema / MovieSummary
  MovieDetailSchema / MovieDetail
  GenreSchema
  PersonSummarySchema
  CastMemberSchema
  KeywordSchema
  TrailerSchema

src/contracts/search.ts
  SearchMoviesQuerySchema / SearchMoviesQuery
  SearchMoviesResponseSchema

src/contracts/movie-detail.ts
  MovieDetailPageDataSchema / MovieDetailPageData
  MovieDetailResponseSchema
```

No separate Similar Movies DTO is required. Similar Movies must reuse the existing paginated `MovieSummary` shape unless implementation proves a contract gap.

### TMDB integration

```text
src/integrations/tmdb/index.ts
  getTmdb

src/integrations/tmdb/adapter.ts
  TmdbAdapter.searchMovies
  TmdbAdapter.getMovieDetail
  TmdbAdapter.getSimilarMovies

src/integrations/tmdb/client.ts
  TmdbClient.searchMovies
  TmdbClient.getMovieDetail
  TmdbClient.getSimilarMovies

src/integrations/tmdb/config.ts
  TMDB_LANGUAGE = "es-AR"
  TMDB_REGION = "AR"
  TMDB_INCLUDE_ADULT = false
  TMDB_TIMEOUT_MS = 10_000
```

The adapter already returns normalized product contracts. Do not add another mapper layer unless a verified UI requirement cannot be satisfied by the existing normalized output.

### Shared API foundation

`src/lib/api/route.ts` already exposes:

```text
runApiRoute
requireViewer
getOptionalViewer
readJsonBody
apiData
apiError
ApiRouteError
toApiErrorCode
```

The previous dependency on branch `feature/interactions-reviews` and commit `dafbd4a` is obsolete: that work is already merged into the current `develop` history.

All new catalog routes must reuse this foundation. Do not create another response envelope, validation wrapper, authentication wrapper, or TMDB error mapper.

### Shared frontend foundation

Reuse where applicable:

```text
src/components/shared/movie-artwork.tsx
  MovieArtwork

src/components/shared/movie-poster-card.tsx
  MoviePosterCard

src/components/shared/page-header.tsx
  PageHeader

src/components/ui/input.tsx
  Input

src/components/ui/button.tsx
  Button
```

Catalog-specific composition belongs under `src/features/movies/`, not `src/components/ui/`.

---

## Ownership Boundaries

### This change owns

```text
src/features/movies/**
src/app/api/movies/search/route.ts
src/app/api/movies/[movieId]/similar/route.ts
Discover search integration required by this PRD
Search result grid and numbered pagination
Similar Movies catalog section
Catalog-specific loading, empty, and error states
Catalog-focused additions to the movie-detail modal
```

### Existing movie-detail code remains in place

```text
src/app/api/movies/[movieId]/route.ts
src/features/movie-detail/movie-detail-service.ts
src/features/movie-detail/movie-detail-factory.ts
src/features/movie-detail/movie-detail-client.ts
src/features/movie-detail/movie-detail-screen.tsx
```

`MovieDetailScreen` is a high-risk shared file because it already composes catalog metadata, personal movie state, and reviews. Catalog implementation may add Similar Movies or extract catalog-only presentation, but must preserve the existing public props and the behavior of interaction/review child components.

### Explicitly untouched

```text
src/app/api/movies/[movieId]/reaction/**
src/app/api/movies/[movieId]/watched/**
src/app/api/movies/[movieId]/reviews/**
src/features/interactions/**
src/features/reviews/**
src/features/movie-detail/movie-reviews.tsx
```

Do not split the existing aggregate detail endpoint during this change. It already returns:

```text
movie
viewerState
reviewSummary
myReview
```

Preserving that response avoids unnecessary frontend and ownership churn.

---

## Movie Catalog Application Layer

Populate `src/features/movies/` with the smallest reusable layer needed for Search and Similar Movies.

Expected responsibilities:

- validate or consume validated catalog inputs;
- call `TmdbAdapter.searchMovies` and `TmdbAdapter.getSimilarMovies`;
- expose browser-facing API clients where client components need them;
- provide reusable search-grid, movie-summary, pagination, and Similar Movies composition;
- keep request state and UI state out of Route Handlers.

Do not move `src/features/movie-detail/` into `src/features/movies/`. Existing working boundaries take precedence over an idealized folder tree.

---

## Search

### User experience

Search is part of the existing Discover screen.

#### Normal mode

- Discover behaves exactly as it does before this change.
- The search field is visible and available without adding a navigation destination.

#### Typing

- Typing updates only local input state.
- Typing MUST NOT call the application API or TMDB.
- Debounced, throttled, predictive, or per-keystroke search is prohibited in this scope.

#### Submission

A search begins only when the user:

- presses Enter in the search form; or
- activates the explicit search button.

The submitted value is trimmed and validated through the shared search contract. The frontend must not submit an empty or whitespace-only query.

#### Search mode

- The normal Discover recommendation stack is replaced by a responsive search-result grid.
- Results use reusable movie summary presentation, preferring `MoviePosterCard` and `MovieArtwork` over duplicates.
- Selecting a result opens the existing movie-detail modal.
- Closing the detail modal returns to the same search query and page.
- Clearing or closing search removes search state, resets the search page to 1, and restores normal Discover.
- A newly submitted query always starts on page 1.

#### Pagination

- Search uses numbered pages only.
- The current page and available range must be understandable without relying on color alone.
- A page request occurs only after explicit page selection.
- Infinite scroll, automatic prefetch-on-scroll, and load-more controls are out of scope.
- Page controls must disable or omit unavailable previous/next actions.
- Changing page keeps the submitted query and moves focus or scroll position to the search results heading so the new results are discoverable.

### API

```http
GET /api/movies/search?query=<text>&page=<number>
```

Create:

```text
src/app/api/movies/search/route.ts
```

Requirements:

- validate URL parameters with `SearchMoviesQuerySchema`;
- use `runApiRoute` and the existing response helpers;
- call catalog application logic, not TMDB directly;
- return `SearchMoviesResponseSchema`-compatible normalized data;
- reuse `PAGE_SIZE = 20` and existing pagination metadata;
- preserve the configured `es-AR` language, `AR` region, and adult-content exclusion already applied by the TMDB client;
- treat an empty valid result set as success, not an error;
- map invalid parameters to `VALIDATION_ERROR`;
- map TMDB failures through the existing `TmdbError` handling;
- avoid exposing raw TMDB errors or payloads.

### Search states

The UI must define and test:

```text
normal Discover
submitted loading
results
empty results
validation-safe no-submit for blank input
recoverable error
page transition loading
```

The latest submitted query/page owns the visible result. A slower obsolete request must not replace newer results.

---

## Movie Detail

### Existing API

```http
GET /api/movies/[movieId]
```

This route already exists and returns `MovieDetailPageData` through the shared API envelope. It combines normalized catalog metadata with optional viewer state and review data.

This change must preserve:

- the route path;
- response compatibility;
- optional-viewer behavior;
- existing reaction, watched, and review composition;
- existing not-found and TMDB error mapping.

### Existing normalized metadata

The shared `MovieDetail` contract already includes:

```text
id
title
originalTitle
overview
tagline
posterPath
backdropPath
releaseDate
runtime
originalLanguage
genres
tmdbRating
tmdbVoteCount
director
cast
keywords
trailer
```

Do not rename or duplicate these fields. Keywords must remain available in the normalized contract; this PRD does not require a new visible keywords section merely because the field exists.

### Trailer

- Continue exposing one normalized trailer or `null`.
- Missing trailer is a valid state and must not produce an error.
- The UI must not render a broken player or inactive trailer action when no trailer exists.

### Modal navigation

- Search results and similar movies open `MovieDetailScreen`.
- No movie-detail permalink route is created.
- Opening a similar movie replaces the displayed movie inside the modal experience rather than stacking multiple dialogs.
- Closing the modal returns focus to the movie card that opened it when that trigger remains available.

---

## Similar Movies

### Purpose

Similar Movies is a catalog relationship supplied by TMDB. It is not personalized Discover ranking.

```text
Similar Movies → TMDB catalog relationship
Discover       → personalized recommendation domain
```

No taste profile, candidate generation, local ranking, or recommendation-engine logic may be added here.

### API

```http
GET /api/movies/[movieId]/similar?page=<number>
```

Create:

```text
src/app/api/movies/[movieId]/similar/route.ts
```

Requirements:

- validate `movieId` with `MovieRouteParamsSchema`;
- validate `page` with `PageQuerySchema`;
- use `runApiRoute` and existing response/error helpers;
- call `TmdbAdapter.getSimilarMovies` through catalog application logic;
- return the existing paginated `MovieSummary` shape;
- treat no similar movies as a valid empty result;
- preserve existing TMDB error mapping;
- perform no personalized ranking.

### Detail-modal integration

- Render Similar Movies as an isolated catalog section inside the existing movie-detail modal.
- Reuse `MoviePosterCard` and `MovieArtwork` where their contracts fit.
- Selecting a similar movie loads it into the same modal experience.
- Prevent the currently open movie from appearing as a selectable similar result if TMDB returns it.
- Reset Similar Movies to page 1 when the active detail movie changes.
- Use explicit numbered pagination for consistency with Search; do not use infinite scroll or load more.
- Provide loading, empty, error, results, and page-transition states without breaking the rest of the detail modal.
- A Similar Movies failure must not make otherwise valid movie details unusable.

---

## Discover Boundary

The existing Discover page currently receives fixture movies. Wiring Discover to the Recommendation Engine or replacing fixture-driven recommendations is out of scope.

This change may modify Discover only to:

- add the submit-only search form;
- switch between normal and search-result modes;
- open the existing detail modal from results;
- restore the prior normal mode after search is cleared;
- preserve existing reaction, assistant, animation, and recommendation-stack behavior while not searching.

Do not redesign or implement:

```text
Taste Profile
Candidate Generation
Local Ranking
Recommendation Engine
Discover API
```

---

## TMDB Cache Boundary

The existing cache is implemented in:

```text
src/db/repositories/movie-cache-repository.ts
```

Current adapter behavior caches movie detail. Search and Similar Movies already use their existing uncached TMDB adapter behavior.

This change must not:

- add list-result caching;
- force Search or Similar Movies through the detail cache;
- rewrite cache persistence or TTL behavior;
- add another cache abstraction;
- store a local copy of the TMDB catalog.

Caching changes require a separately verified performance or reliability need.

---

## Authentication and API Exposure

Movie catalog reads contain public TMDB metadata. Search and Similar Movies should follow the existing public movie-detail read convention and must not require a viewer merely to obtain catalog data.

Product pages remain subject to the application's existing authentication guard. This PRD does not change authentication policy.

---

## Onboarding and Route Guards — Documented Exclusion

The repository contains:

```text
src/proxy.ts
src/features/auth/route-guard.ts
```

The current route guard checks authentication but does not enforce `users.onboardingCompletedAt`. The schema already contains the onboarding-completion field, while the onboarding feature remains incomplete.

This is a known gap, but it affects application-wide Auth/Onboarding navigation rather than movie catalog behavior. Therefore:

- do not modify `src/proxy.ts` for this change;
- do not modify `src/features/auth/route-guard.ts` for this change;
- do not create onboarding routes or UI in this change;
- track onboarding gating as separate Auth/Onboarding work.

---

## Database and Migrations

No database migration is required.

The current schema already supports users, preferences, interactions, reviews, and the movie-detail cache. Search and Similar Movies use TMDB catalog data and do not require new persistence.

Any proposed migration during implementation is a scope deviation and must be justified and approved before creation.

---

## Error Handling and Resilience

All new catalog Route Handlers must use the existing API foundation.

Expected mappings:

```text
invalid route or query input → VALIDATION_ERROR
unknown movie               → MOVIE_NOT_FOUND
TMDB failure or timeout      → TMDB_UNAVAILABLE
```

Additional requirements:

- raw TMDB messages and payloads must not reach the browser;
- a Search error must preserve the submitted query and offer retry;
- a pagination error must preserve the last successful results until retry or navigation;
- a Similar Movies error must remain isolated from the primary detail content;
- repeated submission while a request is pending must not produce stale visible results;
- controls must expose disabled/loading state without trapping keyboard focus.

---

## Accessibility and Responsive Behavior

- The search field must have a programmatic accessible name.
- Enter and the search button must submit the same form behavior.
- Search status/result counts and errors must be announced through an appropriate live region without announcing every keystroke.
- Numbered pagination must expose the current page with `aria-current="page"` or an equivalent semantic.
- Movie cards must be keyboard reachable and have meaningful accessible names.
- Focus must return sensibly after closing the detail modal.
- Search results must adapt from compact mobile columns to the existing desktop content width without horizontal page overflow.
- Existing reduced-motion behavior and UI Foundation tokens must be preserved.

---

## Testing

The repository uses Vitest, Testing Library, and Playwright. Strict TDD is not required, but behavior-first coverage is required for new catalog logic.

### Contract and application tests

Cover:

- valid and invalid search input;
- page defaulting and invalid page values;
- Search service delegation and normalized output;
- Similar Movies service delegation and normalized output;
- empty result handling;
- TMDB failure propagation into shared route mapping;
- exclusion of the active movie from similar results if required at the application boundary.

### Route tests

Cover:

```text
GET /api/movies/search
GET /api/movies/[movieId]/similar
```

Validate:

- success envelope;
- default and explicit page;
- invalid query, page, and movie ID;
- empty results;
- movie not found where applicable;
- TMDB unavailable;
- no raw TMDB error leakage.

API Route Handler tests are a new local convention. Follow the existing `runApiRoute` behavior and mock the application-service boundary rather than creating an alternate test-only route architecture.

### Frontend behavior tests

Cover:

- typing does not issue a request;
- Enter submits once;
- the search button submits once;
- blank input does not submit;
- submitted search replaces normal Discover content;
- clearing search restores normal Discover;
- loading, result, empty, and error states;
- stale responses do not replace newer results;
- numbered page navigation requests only the selected page;
- page changes preserve the submitted query;
- result selection opens the existing movie-detail modal;
- closing detail returns to the same search state;
- Similar Movies loading, result, empty, and isolated error states;
- selecting a similar movie replaces the active movie in the same modal;
- missing trailer remains graceful;
- existing reaction and review behavior is not regressed.

### Required verification

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

Run integration or E2E suites when implementation introduces or changes behavior covered by those suites.

---

## Acceptance Criteria

### Foundation

- [ ] All new catalog routes reuse `src/lib/api/route.ts`.
- [ ] No duplicate API envelope, error mapper, TMDB adapter, or cache is introduced.
- [ ] `src/features/movies/` owns reusable Search and Similar Movies application/UI logic.
- [ ] Existing `src/features/movie-detail/` code remains in place.
- [ ] React components do not call TMDB directly.
- [ ] Shared Zod schemas remain the contract source of truth.
- [ ] No database migration is created.

### Search in Discover

- [ ] Discover contains a clearly labeled search form.
- [ ] Typing does not call the API.
- [ ] Enter and the search button explicitly submit the query.
- [ ] Empty or whitespace-only input does not submit.
- [ ] A submitted query starts at page 1.
- [ ] Search results replace normal Discover content with a responsive movie grid.
- [ ] Search loading, results, empty, error, and page-transition states are implemented.
- [ ] Numbered pagination is used with 20 results per page.
- [ ] No infinite scroll or load-more behavior exists.
- [ ] Changing pages issues only an explicit page request and preserves the query.
- [ ] Selecting a result opens the existing movie-detail modal.
- [ ] Clearing or closing search restores normal Discover.
- [ ] Closing the detail modal preserves the current search query and page.

### Search API

- [ ] `GET /api/movies/search` exists.
- [ ] Query and page are validated with shared schemas.
- [ ] Results match the existing normalized search response contract.
- [ ] Locale, region, adult-content, timeout, and error conventions remain those of the existing TMDB integration.
- [ ] Empty results return successful pagination data.

### Movie Detail

- [ ] The existing aggregate `/api/movies/[movieId]` contract remains compatible.
- [ ] Existing catalog metadata, trailer behavior, viewer state, and review behavior are preserved.
- [ ] Missing trailers remain a valid non-error state.
- [ ] No dedicated movie-detail page is added.
- [ ] Reaction, watched-state, and review endpoints are untouched.

### Similar Movies

- [ ] `GET /api/movies/[movieId]/similar` exists.
- [ ] Route parameters and page are validated with shared schemas.
- [ ] Results use the existing paginated `MovieSummary` shape.
- [ ] Similar Movies render as an isolated section in the existing detail modal.
- [ ] Loading, results, empty, error, and page-transition states are implemented.
- [ ] Numbered pagination is used; no infinite scroll or load-more behavior exists.
- [ ] Selecting a similar movie replaces the active movie in the same modal.
- [ ] Similar Movies failure does not block otherwise valid detail content.
- [ ] No personalized ranking is added.

### Boundaries and quality

- [ ] Fixture-driven Discover recommendations are not rewired or redesigned.
- [ ] Onboarding, proxy, and route-guard behavior are unchanged and documented as separate work.
- [ ] No TMDB cache behavior is changed.
- [ ] Existing interaction/review ownership is preserved.
- [ ] Relevant tests pass.
- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test:run` passes.
- [ ] `pnpm build` passes.

---

## Definition of Done

The feature is complete when:

1. users can submit a movie search from Discover without per-keystroke requests;
2. results appear in a responsive grid with explicit numbered pagination;
3. clearing search restores the existing Discover experience;
4. search results open the existing movie-detail modal;
5. Similar Movies are available through a shared API and render inside that modal;
6. selecting a similar movie reuses the same modal rather than opening nested dialogs or a new page;
7. new routes and services reuse existing contracts, API helpers, TMDB integration, and error mapping;
8. the current aggregate detail endpoint and interaction/review behavior remain compatible;
9. no cache, migration, recommendation-engine, onboarding, or route-guard work is introduced;
10. behavior tests and required repository checks pass.

---

## Final Principle

> Complete only the missing catalog capabilities. Search belongs inside Discover but runs only on explicit submission; movie detail remains a modal; Similar Movies remains catalog data rather than personalized recommendation logic; and every new layer must build on the contracts and infrastructure already present in the repository.
