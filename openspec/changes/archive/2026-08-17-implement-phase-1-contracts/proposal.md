# Proposal: Implement Phase 1 Contracts

## Intent

Establish the foundational Zod data contracts for the MVP. These schemas will act as the single source of truth for validation, type inference, and frontend/backend integration, avoiding manual type duplication and ensuring a stable domain boundary.

## Scope

### In Scope
- Implement all domain schemas in `src/contracts/*.ts` (`common`, `errors`, `movies`, `interactions`, `onboarding`, `preferences`, `search`, `discover`, `likes`, `reviews`, `movie-detail`, `chat`, `index`).
- Infer all TypeScript types using `z.infer`.
- Implement resolved decisions (e.g., `ChatMessage.id` bounds, `ReviewAuthor.avatarUrl` empty string preprocessing, `Trailer.site` allowance).
- Add validation tests for schemas with custom logic (`superRefine`, `preprocess`).
- Minimal test configuration if required.

### Out of Scope
- Implementation of API routes, feature services, or database schemas.
- Implementation of the TMDB adapter or other integrations.
- Generation of fixtures.

## Capabilities

### New Capabilities
- `contracts`: Defines the single source of truth for request/response validation and TypeScript types across the entire application domain.

### Modified Capabilities
- None

## Approach

Create the `src/contracts/` directory and populate it with the schema definitions according to the authoritative `phase-1-final-zod-contracts.md` document. We will use Zod to define schemas and `z.infer` to extract their types. For the specific resolved decisions:
- `ChatMessage.id`: Add `.optional()` to the `z.string().min(1).max(100)` definition.
- `ReviewAuthor.avatarUrl`: Use `z.preprocess((val) => val === "" ? null : val, z.string().url().nullable())`.
- `Trailer.site`: Set to `z.string().min(1)`.
- `ViewerMovieStateSchema`: Ensure it properly accommodates anonymous users with a nullable state where appropriate.
- `LikesWatchedFilter`: Ensure the type is correctly exported via `z.infer<typeof LikesWatchedFilterSchema>`.

Write unit tests for schemas involving `.superRefine` or `.preprocess` (e.g., `ViewerMovieStateSchema`, `ReviewSummarySchema`, `ChatRequestSchema`, `RecommendationFiltersSchema`, `ReviewAuthorSchema`) to guarantee boundary validation correctness.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/contracts/` | New | Addition of domain validation schemas and types |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Custom validation bypasses | Low | Write explicit unit tests for all `.superRefine` and `.preprocess` cases. |

## Rollback Plan

Remove the `src/contracts/` directory and any added test files or configuration, as this is a purely additive structural change.

## Dependencies

- `zod`

## Success Criteria

- [ ] All specified `.ts` files exist in `src/contracts/`.
- [ ] Types are inferred via `z.infer` with zero manual interface duplication.
- [ ] Tests pass for schemas with custom refinements or preprocessors.
- [ ] Resolved decisions are explicitly handled in the schema definitions.
