# Tasks: Implement Phase 1 Contracts

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 600–800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Vitest config + shared contracts + barrel | PR 1 | `pnpm typecheck` and `pnpm test:run` | N/A — no runtime wiring yet | Remove `vitest.config.ts`, `src/contracts/common.ts`, `errors.ts`, `movies.ts`, `index.ts` |
| 2 | Core interaction/discovery domain contracts + RED tests | PR 2 | `pnpm test:run src/contracts/__tests__/{interactions,discover}.test.ts` | N/A — contracts only | Remove `interactions.ts`, `onboarding.ts`, `preferences.ts`, `search.ts`, `discover.ts`, `likes.ts` and their tests; revert `index.ts` |
| 3 | Reviews/chat/detail contracts + remaining tests | PR 3 | `pnpm test:run src/contracts/__tests__/{reviews,chat}.test.ts` and `pnpm typecheck` | N/A — contracts only | Remove `reviews.ts`, `movie-detail.ts`, `chat.ts` and their tests; revert `index.ts` |

## Phase 1: Test Configuration

- [x] 1.1 Create `vitest.config.ts` with TypeScript support and a glob for `src/contracts/**/*.test.ts`.
- [x] 1.2 Run `pnpm test:run` to confirm the runner exits cleanly with zero tests.

## Phase 2: Shared Contracts

- [x] 2.1 Create `src/contracts/common.ts` with `TmdbMovieIdSchema`, ISO date schemas, and pagination schemas enforcing `pageSize = 20` and default `page = 1`.
- [x] 2.2 Create `src/contracts/errors.ts` with `ApiErrorCodeSchema` and `ApiErrorSchema`.
- [x] 2.3 Create `src/contracts/movies.ts` with `MovieSummarySchema`, `MovieDetailSchema`, `GenreSchema`, and `TrailerSchema` using `z.string().min(1)` for `site`.

## Phase 3: Domain Contracts

- [x] 3.1 Create `src/contracts/interactions.ts` with `MovieReactionSchema` and `ViewerMovieStateSchema` using `.superRefine` to reject `watchedAt` without a `reaction`.
- [x] 3.2 Create `src/contracts/onboarding.ts` with `CompleteOnboardingRequestSchema` enforcing at least two unique genre IDs and three unique liked movie IDs.
- [x] 3.3 Create `src/contracts/preferences.ts` with `PreferredGenreIdsSchema` and `UserPreferencesSchema`.
- [x] 3.4 Create `src/contracts/search.ts` with `SearchMoviesQuerySchema` extending pagination and validating a trimmed 1–100 character query.
- [x] 3.5 Create `src/contracts/discover.ts` with `RecommendationFiltersSchema` using `.superRefine` to reject `minRuntime > maxRuntime`.
- [x] 3.6 Create `src/contracts/likes.ts` with `LikesWatchedFilterSchema` defaulting to `"all"` and exporting `LikesWatchedFilter` via `z.infer`.
- [x] 3.7 Create `src/contracts/reviews.ts` with `ReviewVerdictSchema`, `ReviewAuthorSchema` preprocessing empty `avatarUrl` to `null`, and `ReviewSummarySchema` using `.superRefine` for `total` and `recommendationRate` invariants.
- [x] 3.8 Create `src/contracts/movie-detail.ts` with `MovieDetailPageDataSchema`.
- [x] 3.9 Create `src/contracts/chat.ts` with `ChatMessageSchema` (`id` optional 1–100) and `ChatRequestSchema` enforcing 1–20 messages ending with `role = user`.

## Phase 4: Barrel and Validation Tests

- [x] 4.1 Create `src/contracts/index.ts` barrel exporting every schema and inferred type.
- [x] 4.2 Create `src/contracts/__tests__/interactions.test.ts` covering `reaction: null` with `watchedAt: null` (pass) and `watchedAt` without reaction (fail).
- [x] 4.3 Create `src/contracts/__tests__/discover.test.ts` covering valid runtime range (pass) and `minRuntime > maxRuntime` (fail).
- [x] 4.4 Create `src/contracts/__tests__/reviews.test.ts` covering empty `avatarUrl` → `null`, valid `ReviewSummary`, `total` mismatch, and `total = 0` rate behavior.
- [x] 4.5 Create `src/contracts/__tests__/chat.test.ts` covering optional `id`, valid user-ending request, and assistant-ending request failure.
- [x] 4.6 Run `pnpm test:run` and `pnpm typecheck` and fix any failures.
- [x] 4.7 Add runtime tests for public barrel consumption, inferred type ownership, provider-neutral trailers, invalid paging, and the default likes filter.
