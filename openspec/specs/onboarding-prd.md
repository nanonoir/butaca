# PRD — Onboarding

## Document Status

**Feature:** First-time taste onboarding
**Suggested branch:** `feature/onboarding`
**Status:** Refined — Ready for SDD
**Authoritative scope:** Genre selection, initial liked/watched movies, atomic completion, and onboarding-aware navigation
**Canonical post-onboarding route:** `/`

This PRD has been refined against the current repository. It is the source of truth for downstream proposal, specification, design, implementation, and verification work.

---

## 1. Product Intent

Onboarding initializes a newly authenticated user's taste profile before the user enters the product.

The flow has two steps:

```text
Genres → Watched and liked movies → Atomic completion → /
```

Onboarding is not a separate preference or interaction system. It writes normal user preferences and normal movie interactions through the existing domain and persistence layers.

---

## 2. Locked Product Decisions

| Topic | Decision |
|---|---|
| Flow | Two steps: Genres → Movies |
| Genres | Select 2–8 unique TMDB movie genre IDs |
| Movies | Select 3–8 unique TMDB movie IDs |
| Limit scope | The maximum of 8 applies only to onboarding; it must not become a global preference limit |
| Initial movie semantics | Every selected movie becomes `LIKE` with `watchedAt` set to the completion timestamp |
| Search | Reuse the existing movie catalog search endpoint, contracts, client, pagination, and presentation primitives |
| Genre source | Use the existing TMDB movie genre integration; do not use the profile fixture as onboarding's catalog source |
| Persistence | Preferences, interactions, and completion timestamp commit in one database transaction |
| Idempotency | Repeating a completed request returns success without rewriting preferences or interactions |
| Retry | Retry one transient client submission failure automatically; then preserve state and expose manual Retry |
| Completion route | Redirect to `/`, because Discover is currently implemented at `src/app/(app)/page.tsx`; `/discover` does not exist |
| Route gate | Incomplete authenticated users may access `/onboarding` but not normal product pages |
| Completed users | Completed users requesting `/onboarding` are redirected to `/` |
| Recovery | `/reset-password` and `/confirm` retain their existing auth behavior |
| Database | Existing tables and columns are sufficient; no migration is required for onboarding limits |

---

## 3. Codebase Alignment and Invariants

### 3.1 Existing assets that must be reused

| Concern | Existing source of truth |
|---|---|
| Request/response contracts | `src/contracts/onboarding.ts` |
| TMDB ID schemas | `src/contracts/common.ts` |
| API error codes | `src/contracts/errors.ts` |
| Route Handler helpers | `src/lib/api/route.ts` |
| User schema | `src/db/schema/users.ts` |
| Preferences schema | `src/db/schema/user-preferences.ts` |
| Interactions schema | `src/db/schema/user-movie-interactions.ts` |
| User persistence | `src/db/repositories/user-repository.ts` |
| Preference persistence | `src/db/repositories/user-preferences-repository.ts` |
| Interaction persistence | `src/db/repositories/user-movie-interaction-repository.ts` |
| TMDB genres | `TmdbAdapter.getGenres()` in `src/integrations/tmdb/adapter.ts` |
| Movie search route | `GET /api/movies/search` |
| Movie search service/client | `MovieCatalogService.searchMovies` and `fetchSearchMovies` |
| Search result UI | `src/features/movies/components/search-grid.tsx` |
| Search pagination | `src/features/movies/components/pagination.tsx` |
| Movie contracts | `MovieSummary` in `src/contracts/movies.ts` |
| Movie presentation | `MoviePosterCard` and `MovieArtwork` |
| Genre toggle interaction | `EditProfilePreferencesScreen` |
| Navigation guard | `src/features/auth/route-guard.ts` and `src/proxy.ts` |
| Registration form | `src/features/auth/register-form.tsx` |

### 3.2 Repository facts corrected by this refinement

- `src/features/onboarding/` is empty except for `.gitkeep`.
- No `/onboarding` page or `POST /api/onboarding` route exists.
- Discover is the root route `/`; `/discover` is not a valid page.
- Registration currently defaults to `/`, not `/onboarding`.
- The navigation guard currently knows only whether a session exists; it does not inspect `onboardingCompletedAt`.
- `users.onboardingCompletedAt`, preferences, and movie interaction storage already exist.
- The existing onboarding contract uses `preferredGenreIds` and `likedMovieIds`.
- Existing onboarding arrays enforce minimums and uniqueness but do not yet enforce maximum 8.
- The global `PreferredGenreIdsSchema` has no maximum and must remain that way because the onboarding cap is not a permanent preference cap.
- `UserPreferencesRepository.upsert`, `UserMovieInteractionRepository.upsertReaction`, `UserMovieInteractionRepository.setWatched`, and `UserRepository.update` exist.
- Existing repositories use their constructor database directly and are not yet transaction-scoped.
- Search state is embedded in `DiscoverScreen`; only the route, client, contracts, `SearchGrid`, pagination, and movie primitives are currently reusable.
- Search submits explicitly through a form and paginates with page size 20.
- The profile genre UI currently consumes a fixture. Onboarding must instead expose the existing TMDB genre adapter through the catalog boundary.
- `ONBOARDING_REQUIRED` already exists and maps to HTTP 403.

### 3.3 Domain invariants

- Movies only; never expose TMDB TV genres or TV results.
- TMDB IDs remain canonical for genres and movies.
- Onboarding-selected movies are ordinary `LIKE` interactions.
- `watchedAt` is independent from reaction and must be preserved by later reaction changes.
- One completion timestamp is used for every selected movie and `users.onboardingCompletedAt`.
- No onboarding-specific preferences table, interactions table, reaction type, or movie mapper may be introduced.
- React components must not access TMDB or the database directly.
- Zod contracts remain the request and response source of truth.

---

## 4. User Flow

### 4.1 Entry after registration

After successful registration and session establishment:

```text
POST /api/register succeeds
→ navigate to /onboarding
```

The existing `RegisterForm` default success path must change from `/` to `/onboarding`. `src/app/(auth)/register/page.tsx` is a Server Component and renders `<RegisterForm />` without props, so it must not pass a client callback across that boundary. Update the existing form test, which currently asserts `/` despite its onboarding-oriented description.

### 4.2 Step 1 — Genres

The user selects between 2 and 8 unique movie genres.

Required behavior:

- load genre options from the catalog genre endpoint backed by `TmdbAdapter.getGenres()`;
- keep selections local until final completion;
- allow selection and deselection;
- expose selected state with `aria-pressed` or an equivalent semantic control;
- show the selected count and the allowed range;
- disable Continue below 2 selections;
- prevent adding a ninth genre while allowing deselection;
- preserve genre and movie selections when navigating between steps;
- render recoverable genre loading, error, and Retry states.

The maximum of 8 is enforced by the onboarding contract and UI only. It must not be added to `PreferredGenreIdsSchema` or to the database preference constraint.

### 4.3 Step 2 — Movies

The user searches for movies already watched and liked, then selects between 3 and 8 unique movies.

Required behavior:

- submit search only through the existing explicit form interaction;
- use `GET /api/movies/search?query={query}&page={page}`;
- preserve the existing page size and pagination behavior;
- display normalized `MovieSummary` results using shared movie presentation;
- make selected results visibly and programmatically identifiable;
- allow selected movies to be removed from results or the selected summary;
- prevent duplicate TMDB movie IDs;
- prevent adding a ninth movie while allowing removal;
- disable completion below 3 selections;
- preserve selections across search queries, result pages, step navigation, and submission failures.

Selecting a movie means:

```text
reaction = LIKE
watchedAt = completionTimestamp
```

Selection state belongs to onboarding, not to the generic search state.

### 4.4 Completion

```text
valid local selection
→ POST /api/onboarding
→ one database transaction
→ redirect to /
```

The user remains authenticated and must not need to sign in again.

---

## 5. Shared Contracts

### 5.1 Completion request

Refine the existing contract in `src/contracts/onboarding.ts`; do not create a parallel DTO.

Canonical payload:

```json
{
  "preferredGenreIds": [28, 12],
  "likedMovieIds": [550, 680, 155]
}
```

Canonical validation:

```ts
const UniquePreferredGenreIdsSchema = z
  .array(TmdbGenreIdSchema)
  .min(2)
  .max(8)
  .refine((ids) => new Set(ids).size === ids.length);

const UniqueLikedMovieIdsSchema = z
  .array(TmdbMovieIdSchema)
  .min(3)
  .max(8)
  .refine((ids) => new Set(ids).size === ids.length);

export const CompleteOnboardingRequestSchema = z.object({
  preferredGenreIds: UniquePreferredGenreIdsSchema,
  likedMovieIds: UniqueLikedMovieIdsSchema,
});
```

Do not add `.max(8)` to `PreferredGenreIdsSchema` in `src/contracts/preferences.ts`.

### 5.2 Completion response

Reuse the existing response schema:

```json
{
  "data": {
    "completed": true,
    "completedAt": "2026-08-21T18:00:00.000Z"
  }
}
```

The initial successful completion may return 200. An idempotent repeat also returns 200 with the persisted completion timestamp.

### 5.3 Genre response

Expose TMDB movie genres through the existing catalog integration using:

```http
GET /api/movies/genres
```

The response must use a shared Zod contract based on the existing `GenreSchema`/`Genre` shape and the standard `{ data }` envelope. The route delegates to the movie catalog service/integration and never calls TMDB from React.

---

## 6. Backend Architecture

### 6.1 Completion boundary

Add:

```http
POST /api/onboarding
```

Target flow:

```text
POST /api/onboarding
        ↓
runApiRoute
        ↓
readJsonBody(CompleteOnboardingRequestSchema)
        ↓
requireViewer
        ↓
OnboardingService.complete(viewer, input)
        ↓
db.transaction(...)
```

The Route Handler must not orchestrate repositories directly.

### 6.2 Application service behavior

`OnboardingService.complete` must:

1. use the viewer ID from the authenticated server session, never from the payload;
2. return the existing completion timestamp immediately when `viewer.onboardingCompletedAt` is already set;
3. create one `completionTimestamp`;
4. run all first-completion writes inside one Drizzle transaction;
5. re-read and lock or conditionally claim the user completion state inside that transaction before writing, because the viewer snapshot may be stale under concurrent requests;
6. call `UserPreferencesRepository.upsert(userId, preferredGenreIds)`;
7. persist every selected movie as `LIKE` and watched at the same timestamp;
8. call `UserRepository.update(userId, { onboardingCompletedAt: completionTimestamp })`;
9. fail if the user completion write unexpectedly returns no record;
10. return the committed completion state.

### 6.3 Transaction-capable repositories

The current repositories are not transaction-aware. Implementation must add the smallest shared executor abstraction that allows these existing repositories to operate against either the root Drizzle database or a transaction executor.

Acceptable design:

```text
db.transaction(async (tx) => {
  const preferences = new UserPreferencesRepository(tx-compatible executor)
  const interactions = new UserMovieInteractionRepository(tx-compatible executor)
  const users = new UserRepository(tx-compatible executor)
  // existing repository operations only
})
```

Equivalent dependency injection is acceptable if it keeps transaction typing explicit and avoids raw SQL duplication in `OnboardingService`.

Do not create a second set of onboarding-only SQL methods merely to avoid adapting the existing repositories.

### 6.4 Interaction persistence

The existing `upsertReaction` and `setWatched` methods preserve the independent-state invariant but require two calls per selected movie. Both calls must run inside the same transaction.

A repository method that atomically upserts reaction and watched state may be added if it is generally named, preserves existing semantics, and is covered by repository tests. Bulk persistence is optional because onboarding is capped at eight movies.

### 6.5 Atomicity

The following writes are one unit:

```text
BEGIN
  upsert preferred genres
  upsert LIKE for each selected movie
  set watchedAt for each selected movie
  set users.onboardingCompletedAt
COMMIT
```

Any failure rolls back every write. Partial preference, interaction, or completion states are not acceptable.

### 6.6 Idempotency and concurrency

- A request observed after completion returns the persisted completion timestamp and does not mutate data.
- Existing unique keys prevent duplicate preference and interaction rows.
- The completion check and writes must occur in the same transaction.
- Concurrent first-completion requests must not allow the later request to reinterpret onboarding as preference editing.
- The design phase must select a database-safe strategy, such as locking the user row or a conditional completion update, and prove it with an integration test.

---

## 7. Frontend Architecture

### 7.1 Route and feature

Add the onboarding page using the existing App Router conventions and place onboarding-specific UI/orchestration under:

```text
src/features/onboarding/
```

Conceptual composition:

```text
OnboardingScreen
├── step/progress semantics
├── GenreSelectionStep
└── MovieSelectionStep
    ├── shared movie search behavior
    ├── shared SearchGrid/pagination presentation
    └── onboarding-owned selected movies
```

Exact component count is a design decision; avoid ceremonial files and premature abstractions.

### 7.2 Search extraction

Search state currently lives in `DiscoverScreen`. Extract the smallest reusable movie-search boundary that preserves:

- draft versus submitted query;
- explicit form submission;
- page changes;
- stale-request protection;
- loading, updating, results, empty, error, and Retry states;
- clear/reset behavior used by Discover.

`DiscoverScreen` and onboarding must consume the shared behavior. Existing Discover behavior and tests must remain unchanged.

`SearchGrid` may be extended with a general presentation/selection slot, or onboarding may wrap shared cards. It must not acquire onboarding-owned state.

### 7.3 Movie card reuse

Reuse `MoviePosterCard` and `MovieArtwork`. Prefer the existing presentation slot for a selected indicator. An onboarding wrapper is acceptable; copying the card implementation is not.

### 7.4 Local state

Before completion, keep in React state:

```text
current step
selected genre IDs
selected movies needed for display and submission
movie search state through the shared search boundary
submission/retry state
```

No server draft, localStorage, or sessionStorage persistence is required. A failed request must not clear state.

### 7.5 Submission client

Follow the existing JSON `apiRequest`/client-module pattern. Do not introduce a Server Action solely for onboarding.

Prevent duplicate concurrent submissions while one attempt or its automatic retry is in progress.

---

## 8. Route Enforcement

### 8.1 Canonical decisions

Extend the pure route guard beyond the current `isAuthenticated` boolean so it can decide from trusted onboarding state.

```text
API path
→ continue; each Route Handler authorizes itself

guest + /onboarding
→ /login

authenticated + incomplete + /onboarding
→ continue

authenticated + incomplete + normal product page
→ /onboarding

authenticated + complete + /onboarding
→ /

authenticated + complete + normal product page
→ continue
```

### 8.2 Existing auth rules that must remain intact

- `/login`, `/register`, and `/forgot-password` remain guest-only.
- `/reset-password` remains reachable during a recovery session, including when onboarding is incomplete.
- `/confirm` retains its current public callback behavior.
- `/ui-foundation` retains its current public behavior.
- `/api/*` continues through the proxy without navigation redirects.
- Session cookies refreshed by `updateSession` must still be copied to redirect responses.

### 8.3 Trusted onboarding state

`users.onboardingCompletedAt` is the source of truth. The client must not decide whether the route gate is complete.

The proxy currently receives only `isAuthenticated`. Extend the server-side navigation path so the authenticated user's ID/profile is resolved from validated Supabase claims and `onboardingCompletedAt` is read from `UserRepository` before calling `resolveRouteGuard`.

Do not put the completion state in a client-controlled cookie. A profile lookup failure must fail closed and must never be interpreted as completed onboarding.

### 8.4 API enforcement

`POST /api/onboarding` calls `requireViewer` and remains reachable to incomplete users because the proxy never redirects API routes.

The existing `ONBOARDING_REQUIRED` error code remains available for private product APIs. Expanding every existing API route to enforce onboarding is outside this PRD unless required to prevent a concrete bypass from the shipped UI.

---

## 9. Retry and Error Handling

### 9.1 Client retry policy

```text
submit
→ if transient failure: retry once automatically
→ if retry also fails: preserve state + show error + show manual Retry
```

Retryable:

- network interruption;
- HTTP 500 `INTERNAL_ERROR`;
- HTTP 503 provider/service unavailability.

Not automatically retryable:

- `VALIDATION_ERROR`;
- `UNAUTHORIZED`;
- `FORBIDDEN`;
- `ONBOARDING_REQUIRED`;
- any other explicit non-transient 4xx error.

Manual Retry starts a new submission cycle and may again receive one automatic transient retry.

### 9.2 API errors

Use `runApiRoute`, `readJsonBody`, `requireViewer`, `apiData`, and existing mappings.

Expected codes:

| Condition | Code | HTTP |
|---|---|---|
| Invalid payload | `VALIDATION_ERROR` | 400 |
| No viewer/profile | `UNAUTHORIZED` | 401 |
| Unexpected persistence failure | `INTERNAL_ERROR` | 500 |
| Genre catalog unavailable | `TMDB_UNAVAILABLE` | 503 |

Never expose raw database or provider errors.

---

## 10. UX, Accessibility, and Responsive Requirements

### 10.1 Required UI states

Genres:

- loading;
- loaded options;
- recoverable error with Retry;
- selected count and min/max guidance.

Movie search:

- idle;
- initial loading;
- paginated results;
- updating page;
- empty results;
- recoverable error with Retry.

Completion:

- idle;
- submitting;
- automatic retry in progress;
- exhausted error with manual Retry;
- success navigation.

### 10.2 Accessibility

- expose the current step semantically;
- use keyboard-operable genre and movie controls;
- expose selected/unselected state programmatically;
- provide meaningful movie accessible names;
- announce counts, validation, loading, updating, and errors appropriately;
- do not communicate limits or selection by color alone;
- move focus intentionally when changing steps and when search results change;
- preserve current reduced-motion and focus-visible conventions.

Reuse the `SearchGrid` focus/status pattern and the profile genre `aria-pressed` pattern.

### 10.3 Responsive behavior

- support mobile, tablet, and desktop using current breakpoints;
- reuse the existing responsive movie grid;
- prevent horizontal page overflow;
- do not create an onboarding-specific design system.

---

## 11. Database and Migration Policy

The current schema already supports:

- `users.onboardingCompletedAt`;
- `user_preferences.preferredGenreIds`;
- `user_movie_interactions.reaction`;
- `user_movie_interactions.watchedAt`.

No migration is required.

The database preference constraint intentionally continues to enforce the existing minimum/positive-ID rules without a global maximum. The onboarding-only maximum of 8 belongs in `CompleteOnboardingRequestSchema` and the application UI.

Repository transaction typing changes are code changes, not schema migrations.

---

## 12. Testing Requirements

### 12.1 Contract tests

Cover both arrays at minimum, maximum, below minimum, above maximum, invalid IDs, and duplicate IDs. Verify the canonical field names `preferredGenreIds` and `likedMovieIds`.

Add regression coverage proving `PreferredGenreIdsSchema` still accepts more than eight unique genres outside onboarding.

### 12.2 Application service tests

Cover:

- one shared completion timestamp;
- preference upsert;
- every movie persisted as `LIKE` and watched;
- completion timestamp update;
- all repositories use the transaction executor;
- failure at each write stage rolls back;
- already-completed request returns success without writes;
- concurrent first-completion requests cannot rewrite onboarding data.

### 12.3 Repository integration tests

Using the existing `tests/integration/` database strategy, cover:

- repositories operating with the transaction executor;
- rollback after preference, interaction, or user-update failure;
- interaction upserts do not duplicate rows;
- repeated completion does not rewrite preferences/interactions;
- concurrent completion handling.

### 12.4 Route tests

`POST /api/onboarding`:

- unauthenticated → 401;
- valid minimum and maximum payloads → success envelope;
- invalid counts/IDs/duplicates → 400;
- service failure → 500 without raw details;
- already completed → 200 with persisted completion timestamp.

`GET /api/movies/genres`:

- returns normalized movie genres;
- provider failure maps through the existing TMDB error convention.

### 12.5 Frontend behavior tests

Cover:

- genre loading/error/retry;
- 2–8 unique genre selection and ninth-option prevention;
- step navigation preserves both selections;
- search submits explicitly and reuses the shared search behavior;
- pagination remains available;
- search loading, empty, error, and Retry states;
- 3–8 unique movie selection and ninth-option prevention;
- removal allows another selection;
- duplicate concurrent submission prevention;
- one automatic retry only for transient errors;
- exhausted/manual Retry preserves state;
- success navigates to `/`.

Retain and extend Discover tests to prove the search extraction causes no regression.

### 12.6 Route guard and proxy tests

Cover:

- guest → existing auth behavior;
- guest `/onboarding` → `/login`;
- incomplete user `/onboarding` → continue;
- incomplete user normal product route → `/onboarding`;
- completed user `/onboarding` → `/`;
- completed user normal product route → continue;
- incomplete recovery user can reach `/reset-password`;
- `/api/onboarding` is not redirected by proxy;
- no self-redirect loop;
- refreshed cookies survive redirects;
- missing/unavailable trusted profile state does not unlock the product.

### 12.7 End-to-end coverage

Add the existing Playwright feature structure when the environment can provision authenticated users:

```text
tests/onboarding/onboarding-page.ts
tests/onboarding/onboarding.spec.ts
tests/onboarding/onboarding.md
```

Cover registration entry, incomplete-user gating, full completion, completed-user redirect, and preserved state after a recoverable failure.

---

## 13. Required Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm test:integration
pnpm test:e2e
pnpm build
```

If integration or E2E environments are unavailable, record the exact blocker; do not report those suites as passed.

---

## 14. Out of Scope

- preference editing after onboarding;
- watchlist;
- TV shows;
- onboarding drafts persisted across refresh/device changes;
- changing the product's canonical Discover route from `/` to `/discover`;
- adding a global maximum of eight preferred genres;
- enforcing onboarding in every existing API route without a demonstrated product bypass;
- new recommendation algorithms, embeddings, collaborative filtering, or pgvector;
- an onboarding-specific genre catalog, movie mapper, persistence model, or design system.

---

## 15. Acceptance Criteria

### Flow and UI

- [x] Registration success enters `/onboarding`.
- [x] Genre options come from the TMDB-backed catalog boundary.
- [x] The user can select 2–8 unique genres and cannot continue below 2.
- [x] The onboarding cap does not alter global preference limits.
- [x] The user can search and paginate through the existing movie catalog search.
- [x] The user can select 3–8 unique watched-and-liked movies.
- [x] Selections remain accessible, removable, and preserved across steps/searches/failures.
- [x] Existing Discover search behavior remains unchanged after extraction.

### Persistence

- [x] The existing onboarding Zod contract uses `preferredGenreIds` and `likedMovieIds` with min/max/uniqueness rules.
- [x] Existing preference, interaction, and user repositories are reused.
- [x] Selected genres become current preferences.
- [x] Selected movies become `LIKE` with a shared `watchedAt` timestamp.
- [x] `onboardingCompletedAt` use the same timestamp.
- [x] All writes commit or roll back together.
- [x] Repeated and concurrent completion requests cannot duplicate or reinterpret onboarding data.
- [x] No schema migration or onboarding-specific persistence model is introduced.

### Navigation and failure handling

- [x] Incomplete authenticated users are gated to `/onboarding`.
- [x] Completed users requesting `/onboarding` are redirected to `/`.
- [x] Auth, recovery, public gallery, and API behavior remain intact.
- [x] Route decisions use server-trusted profile state and do not loop.
- [x] One automatic retry occurs only for transient completion failures.
- [x] Retry exhaustion preserves selections and exposes manual Retry.

### Architecture and quality

- [x] Route Handlers delegate to application services.
- [x] React does not access TMDB or the database directly.
- [x] Shared contracts, API helpers, catalog search, pagination, and movie primitives are reused.
- [x] Repository transaction support is explicit and integration-tested.
- [x] Relevant unit, integration, route, guard, E2E, lint, typecheck, and build verification is completed or explicitly blocked.

---

## 16. Definition of Done

The feature is complete when a newly authenticated user is forced through the two-step flow, selects valid initial tastes using the existing catalog boundaries, commits preferences/interactions/completion atomically and idempotently, lands on `/`, and can no longer re-enter first-time onboarding. Existing auth recovery, Discover search, persistence invariants, and broader future preference capacity must remain intact.

> Onboarding initializes the existing taste model; it does not create a parallel one.
