# Design: Implement Phase 1 Contracts

## Technical Approach

Establish Zod 4 validation schemas within `src/contracts/` as the single source of truth for the application's domain. We will define primitive schemas in `common.ts` and compose them in domain-specific modules. TypeScript types will be inferred exclusively via `z.infer`. Custom validations defined in the specs (e.g., cross-field logic for `ViewerMovieState` and `ReviewSummary`) will use `.superRefine`, and empty-string normalizations will use `z.preprocess`. We will also configure Vitest to ensure custom schema logic is tested.

## Architecture Decisions

### Decision: Schema and Type Extraction

**Choice**: Define all validation requirements using Zod 4 and infer TypeScript types with `z.infer<typeof Schema>`.
**Alternatives considered**: Manually authoring TypeScript `interface`s that mirror Zod schemas.
**Rationale**: Eliminates duplication and guarantees that the runtime validation boundary perfectly matches compile-time types.

### Decision: Module Organization

**Choice**: Split contracts into domain-specific files (`movies.ts`, `interactions.ts`, etc.) with a single barrel export at `src/contracts/index.ts`.
**Alternatives considered**: A single monolithic `contracts.ts` file.
**Rationale**: Prevents circular dependencies, improves readability, and aligns with the modular monolith architecture.

### Decision: Handling Zod 4 Syntax

**Choice**: Utilize Zod 4 top-level validators (e.g., `z.uuid()`, `z.url()`) instead of chained string methods (e.g., `z.string().uuid()`), overriding older examples in the spec.
**Alternatives considered**: Stick to Zod 3 syntax shown in legacy spec blocks.
**Rationale**: Ensures compatibility with the installed `zod@^4.4.3` dependency and avoids deprecation warnings or runtime errors.

### Decision: Testing Scope

**Choice**: Only write Vitest unit tests for schemas containing `.superRefine` or `.preprocess`.
**Alternatives considered**: Write tests for every single property in every schema.
**Rationale**: Zod's internal test suite already guarantees that `z.string().min(3)` works. Testing should focus on our custom invariants (e.g., `watchedAt` requires a reaction).

### Decision: Preprocessing Empty Strings

**Choice**: Use `z.preprocess((val) => val === "" ? null : val, z.url().nullable())` for `ReviewAuthor.avatarUrl`.
**Alternatives considered**: Allowing empty strings and handling them in the UI.
**Rationale**: Standardizes missing data as `null` at the boundary, simplifying downstream logic and adhering to the spec.

## Data Flow

    External Input (API/Client)
         │
         ▼
    Zod Contracts (src/contracts/*.ts)
    (Validation, Defaulting, Preprocessing)
         │
         ▼
    Application Services (Typed via z.infer)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `vitest.config.ts` | Create | Minimal Vitest configuration for TypeScript support. |
| `src/contracts/common.ts` | Create | Shared schemas: `TmdbMovieId`, pagination, dates, etc. |
| `src/contracts/errors.ts` | Create | Standardized `ApiError` and `ApiErrorCode`. |
| `src/contracts/movies.ts` | Create | `MovieSummary`, `MovieDetail`, `Genre`, `Trailer` with non-empty `site`. |
| `src/contracts/interactions.ts` | Create | `ViewerMovieState` (with `.superRefine` for `watchedAt`), `MovieReaction`. |
| `src/contracts/onboarding.ts` | Create | `CompleteOnboardingRequest` with duplicate ID checks. |
| `src/contracts/preferences.ts` | Create | `UserPreferences` and `PreferredGenreIds`. |
| `src/contracts/search.ts` | Create | `SearchMoviesQuery` extending pagination. |
| `src/contracts/discover.ts` | Create | `RecommendationFilters` with `minRuntime` <= `maxRuntime` refinement. |
| `src/contracts/likes.ts` | Create | `LikesQuery` with default "all" filter and `LikesWatchedFilter` type export. |
| `src/contracts/reviews.ts` | Create | `ReviewSummary` with total calculation refinement, `ReviewAuthor` with empty string preprocess. |
| `src/contracts/movie-detail.ts` | Create | Aggregated `MovieDetailPageData`. |
| `src/contracts/chat.ts` | Create | `ChatRequest` (validating last message is 'user') and optional `id` validation. |
| `src/contracts/index.ts` | Create | Barrel file exporting all types and schemas. |
| `src/contracts/__tests__/*` | Create | Test files for schemas with custom refinements (`interactions.test.ts`, `discover.test.ts`, `reviews.test.ts`, `chat.test.ts`). |

## Interfaces / Contracts

**Empty String Preprocessing Example (Zod 4)**
```typescript
import { z } from "zod";

export const ReviewAuthorSchema = z.object({
  displayName: z.string().min(1).max(80),
  avatarUrl: z.preprocess(
    (val) => (val === "" ? null : val),
    z.union([z.url(), z.null()])
  ),
});
```

**Optional Chat ID Example**
```typescript
export const ChatMessageSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Custom Validation Rules | Vitest tests for schemas using `.superRefine` or `.preprocess`. |
| Unit | `ViewerMovieState` | Assert that `reaction: null` with `watchedAt: null` passes, but `reaction: null` with `watchedAt: "date"` fails. |
| Unit | `ReviewSummary` | Assert that `total === recommended + notWorthIt` and `recommendationRate === null` when `total === 0`. |
| Unit | `ChatRequest` | Assert that `messages` array ending with `assistant` is rejected. |
| Unit | `RecommendationFilters` | Assert that `minRuntime > maxRuntime` fails. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. This is an additive change to establish the contract foundation.

## Open Questions

None.
