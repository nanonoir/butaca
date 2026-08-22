# Contracts Specification

## Purpose

Define shared Zod validation contracts and inferred TypeScript types for the movie-only MVP. This specification covers contract behavior only; routes, persistence, features, fixtures, and provider integrations are out of scope.

## Requirements

### Requirement: Contract Module Surface

The system MUST expose contracts for common values, errors, movies, interactions, onboarding, preferences, search, discovery, likes, reviews, movie detail, and chat through a single public contracts entry point. Every exported contract type MUST be inferred with `z.infer`; manually duplicated domain interfaces MUST NOT be introduced.

#### Scenario: Public contract consumption

- GIVEN a consumer imports from the public contracts entry point
- WHEN it requests a documented schema or inferred type
- THEN the contract MUST be available without importing an internal module

#### Scenario: Type ownership

- GIVEN a schema has an exported TypeScript type
- WHEN the type is inspected
- THEN it MUST be derived from that schema with `z.infer`

### Requirement: Shared Movie and Paging Values

The system MUST validate positive integer TMDB identifiers, ISO date/time values, movie summaries and details, and standard response envelopes. Paged contracts MUST use a fixed page size of 20; public page input MUST default to 1 and MUST NOT accept a client-selected page size. Trailer `site` MUST accept any non-empty string.

#### Scenario: Valid provider-neutral trailer

- GIVEN a trailer with a non-empty site name not limited to a known platform
- WHEN it is parsed
- THEN the trailer contract MUST accept it

#### Scenario: Invalid paging value

- GIVEN a public page input below 1 or a pagination meta pageSize other than 20
- WHEN it is parsed
- THEN validation MUST fail

### Requirement: Interaction and Onboarding Invariants

The system MUST restrict reactions to `LIKE` and `DISLIKE`. Viewer movie state MUST permit `reaction: null` with either a null or non-null `watchedAt`, because watched state is independent from reactions. Onboarding and preferred genres MUST require unique positive IDs, at least two genres, and onboarding MUST require at least three unique liked movie IDs.

#### Scenario: Anonymous viewer state

- GIVEN a viewer has no reaction
- WHEN state contains null reaction and null watchedAt
- THEN validation MUST succeed

#### Scenario: Watched state without a reaction

- GIVEN a viewer state contains null reaction and a timestamp
- WHEN it is parsed
- THEN validation MUST succeed and preserve watchedAt

### Requirement: Search, Discover, and Likes Contracts

The system MUST validate a trimmed search query of 1–100 characters. Discover batches MUST contain no more than 20 movies. Recommendation filters MUST reject a minimum runtime greater than maximum runtime. Likes filtering MUST allow only `all`, `watched`, or `unwatched`, default to `all`, and export `LikesWatchedFilter` using `z.infer<typeof LikesWatchedFilterSchema>`.

#### Scenario: Invalid runtime range

- GIVEN recommendation filters set minRuntime higher than maxRuntime
- WHEN the filters are parsed
- THEN validation MUST fail at maxRuntime

#### Scenario: Default likes filter

- GIVEN a likes query omits watched
- WHEN it is parsed
- THEN watched MUST equal `all`

### Requirement: Review and Chat Validation

The system MUST restrict review verdicts to `RECOMMENDED` or `NOT_WORTH_IT`, trim review titles to 3–30 characters, and trim descriptions to 10–400 characters. Empty-string review avatar URLs MUST preprocess to null; non-empty avatar URLs MUST be valid URLs. Review summaries MUST require total to equal both verdict counts and require a null rate when total is zero. Chat messages MUST allow an optional ID of 1–100 characters, and chat requests MUST contain 1–20 messages ending with a user message.

#### Scenario: Empty review avatar

- GIVEN a review author supplies an empty avatar URL
- WHEN the author is parsed
- THEN avatarUrl MUST equal null

#### Scenario: Invalid chat completion turn

- GIVEN a chat request whose final message has assistant role
- WHEN the request is parsed
- THEN validation MUST fail for messages

#### Scenario: Valid optional chat ID

- GIVEN a chat message omits id
- WHEN the message is parsed
- THEN validation MUST succeed

### Requirement: Custom Validation Coverage

The system MUST provide automated validation coverage for every contract using cross-field refinement or preprocessing, including viewer state, recommendation filters, review summaries, review authors, and chat requests. Tests MUST assert both accepted boundary data and rejected invalid data.

#### Scenario: Custom rule acceptance

- GIVEN boundary-valid data for a refined or preprocessed contract
- WHEN its validation test runs
- THEN parsing MUST produce the specified normalized or accepted value

#### Scenario: Custom rule rejection

- GIVEN data that violates a cross-field invariant
- WHEN its validation test runs
- THEN parsing MUST report validation failure
