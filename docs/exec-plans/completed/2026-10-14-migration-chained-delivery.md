# Chained migration delivery to develop

## Objective and authorization

Deliver all approved session work through eight coherent chained PRs and merge them into `develop`. Owner approved this plan and a size exception for the atomic migration cutover only. Do not change `main`, deploy, touch production, or bypass tool/branch permissions.

## Starting point and preservation

- `origin/develop`: `2dff74eaae5384fd716b7b2f7af309b602088556`, synchronized by PR #43 to main's tree.
- `origin/main`: `aeb0dda1749e84a531d8fbfb863e8cd610f94f00`, remains unchanged.
- Original working directory stays on `feat/postgresql-better-auth`; it contains the approved migration, documentation reorganization, registration UX, profile verification, README and screenshot. Preserve it; prepare delivery in a separate clean worktree.
- Backup of old develop remains `backup/develop-before-main-20261014`.
- References: completed migration, registration UX and develop baseline ExecPlans; `docs/PLANS.md`.

## Chain and acceptance

Each branch starts from its predecessor. Each PR initially targets that predecessor; retarget to develop after the predecessor merges. Use merge commits, retain needed branches, measure each actual diff, and validate every intermediate state.

1. [x] Documentation organization, with baseline-accurate current behavior. Feature-specific updates follow their code.
2. [x] Inactive Resend transport, DB operational-error utilities and PostgreSQL app-role bootstrap, with tests.
3. [x] Add pinned Better Auth dependencies (retain Supabase until cutover), inactive identity schema/config/rate limiter and tests, shared password ceiling constant.
4. [x] Inactive Better Auth engine, mail context and provider port, with tests. Runtime singleton wiring stays with cutover.
5. [x] Atomic runtime cutover: service/factory, HTTP/token/guard/proxy, baseline/FKs, environment/Docker/readiness, test replacement and Supabase removal. Related docs included. **Owner-approved size exception**: this coupled unit exceeds 600 authored lines; disclose measured size in its PR. Do not fabricate temporary dual-provider behavior to reduce the count.
6. [x] Registration email-first/nickname/progressive-feedback UX, tests and spec.
7. [x] Non-gating profile email-verification status/retry UX, tests and docs.
8. [x] README/showcase image and final documentation/reconciliation/validation evidence.

Other units must stay within 600 manually authored additions+deletions, including tests/config/manual SQL. Exclude docs, lockfile and demonstrably generated snapshots/SQL, not entire arbitrary extensions. Report exclusions and renames explicitly.

## Verification

- Lint, Next type generation/TypeScript, unit tests and build before each PR. Use bounded workers and fake build configuration on Supabase baseline states.
- At cutover and on complete develop: isolated PostgreSQL integration, E2E, production/Docker builds and migration checks; no private application env fallback.
- Independent review of cutover and final chain coherence. No admin/force/bypassed requirements.
- Confirm final remote develop matches the intended approved source plus deliberate delivery documentation changes; original pending work remains preserved.

## Decisions, evidence and preparation log

### Execution & PR Delivery Log

- **Dedicated Worktree**: Prepared in clean worktree `C:/Users/Nahuel/AppData/Local/Temp/opencode/butaca-migration-delivery` with branches chained progressively. No retry or bypass of tool permissions was required.
- **Source Workspace Preservation**: Original workspace `C:/Users/Nahuel/Desktop/works/butaca` remained on `feat/postgresql-better-auth` with all 185+ uncommitted user files preserved untouched, adding only this execution plan and the intentional `*.sh text eol=lf` rule in `.gitattributes`.
- **Line Endings Configuration**: Added `*.sh text eol=lf` to `.gitattributes` across both workspaces to guarantee PostgreSQL init shell scripts retain Linux LF endings upon checkout on Windows platforms.

#### Chain Summary & Measured Authored Diffs

1. **PR #44 (`chore/delivery-01-docs`)**
   - Base / Target: `origin/develop` (`2dff74e`)
   - Content: Canonical documentation reorganization, removing legacy OpenSpec artifacts and aligning documentation structure. Markdown files excluded from line counts per protocol.
   - Measured Authored Diff: 61 authored deletions (OpenSpec config), 0 authored additions (<600 budget).
   - Merge Commit: `c0d7161` (Merge pull request #44 from nanonoir/chore/delivery-01-docs).
   - Validation: 84 files / 702 unit tests, ESLint, Next typegen, strict TypeScript, Next production build passed.

2. **PR #45 (`feat/delivery-02-foundations`)**
   - Base / Target: `develop` post-#44
   - Content: Inactive Resend transactional email transport client, database operational-error mapping utilities (`src/db/errors.ts`), and PostgreSQL application-role initialization script (`docker/postgres/init-app-role.sh`).
   - Measured Authored Diff: 356 authored additions (<600 budget).
   - Merge Commit: `6cf875d` (Merge pull request #45 from nanonoir/feat/delivery-02-foundations).
   - Validation: 86 files / 720 unit tests, ESLint, Next typegen, strict TypeScript, Next production build passed.

3. **PR #46 (`feat/delivery-03-identity`)**
   - Base / Target: `develop` post-#45
   - Content: Pinned Better Auth dependencies (retaining Supabase packages until cutover), inactive identity schema (`src/db/schema/auth.ts`), config, rate-limiter utilities, and shared password ceiling constant.
   - Measured Authored Diff: 286 authored additions; generated `pnpm-lock.yaml` (+328/-23) excluded per protocol (<600 budget).
   - Merge Commit: `45a1abd` (Merge pull request #46 from nanonoir/feat/delivery-03-identity).
   - Validation: 88 files / 725 unit tests, ESLint, Next typegen, strict TypeScript, Next production build passed.

4. **PR #47 (`feat/delivery-04-auth-engine`)**
   - Base / Target: `develop` post-#46
   - Content: Inactive Better Auth server instance engine (`src/integrations/better-auth/`), mail context, provider port, and comprehensive unit tests. Runtime singleton wiring deferred to cutover.
   - Measured Authored Diff: 543 authored additions (<600 budget).
   - Merge Commit: `84c98bf` (Merge pull request #47 from nanonoir/feat/delivery-04-auth-engine).
    - Validation: 89 files / 739 unit tests, ESLint, Next typegen, strict TypeScript, Next production build passed.

5. **PR #48 (`feat/delivery-05-auth-cutover`)**
   - Base / Target: `develop` post-#47
   - Content: Atomic runtime cutover from Supabase to PostgreSQL and Better Auth: HTTP auth route handlers, token helpers, route guard, proxy matching, Drizzle schema and migrations (`0000_initial_schema.sql`, `0001_auth_profile_trigger.sql`), server auth service and factory, readiness endpoint (`/api/ready`), environment contract updates, Dockerfile/compose, integration/E2E test harness replacement, and complete removal of Supabase client/proxy.
   - Measured Authored Diff: 4,684 additions + 1,509 deletions = 6,193 authored lines. **Owner-approved size exception** applied exclusively to this unit to maintain atomic runtime integrity without introducing artificial dual-provider shims. Excluded per protocol: documentation, lockfile, and generated Drizzle snapshots/journal; manual SQL included.
   - Independent Review: Independent reviewer reported PASS with 2 nonblocking suggestions noted below.
   - Merge Commit: `f9138b3` (Merge pull request #48 from nanonoir/feat/delivery-05-auth-cutover).
    - Validation: 94 files / 802 unit tests; 86 integration tests passed (8 opt-in live-TMDB skipped); 19 Playwright E2E tests passed; ESLint, Next typegen, strict TypeScript, native build, Docker Compose config, `drizzle-kit check`, and Docker runner/migration builds passed. Independent review: PASS.

6. **PR #49 (`fix/delivery-06-registration-ux`)**
   - Base / Target: `develop` post-#48
   - Content: Registration UX enhancements: email-first layout, client-side nickname validation, progressive password requirement checklist feedback, test updates, and product spec reconciliation.
   - Measured Authored Diff: 258 authored additions/modifications (<600 budget).
   - Merge Commit: `64e9266` (Merge pull request #49 from nanonoir/fix/delivery-06-registration-ux).
    - Validation: 94 files / 807 unit tests, ESLint, Next typegen, strict TypeScript, Next production build passed.

7. **PR #50 (`feat/delivery-07-profile-verification`)**
   - Base / Target: `develop` post-#49
   - Content: Non-gating profile email verification banner and status indicator, resend verification action handler, component and route tests, and related documentation.
   - Measured Authored Diff: 162 authored additions/modifications (<600 budget).
   - Merge Commit: `32b83ad` (Merge pull request #50 from nanonoir/feat/delivery-07-profile-verification).
   - Validation: 95 files / 811 unit tests, ESLint, Next typegen, strict TypeScript, Next production build passed.

8. **PR #51 (`docs/delivery-08-showcase`)**
   - Base / Target: `develop` post-#50 (`32b83addd75284e9baae7804c6d7ca1a861b742f`)
   - Content: Project README update reflecting PostgreSQL and Better Auth architecture, repo showcase screenshot asset (`public/butaca-repo.webp`), and completed ExecPlan archiving.
   - Measured Authored Diff: 0 authored code lines (Markdown documentation and static media only).
    - Delivery Status: Merged to `develop` as the final PR in the owner-approved chain, using a normal merge commit.

## Implementation Outcome

### Implemented

- **PostgreSQL & Better Auth Migration Delivery**: Successfully delivered the complete architectural migration from Supabase to self-hosted PostgreSQL (Docker 17) and Better Auth across a structured 8-PR delivery chain merged into `develop`.
- **Infrastructure & Persistence**: Established Drizzle ORM schema, automated migrations (`0000_initial_schema.sql`, `0001_auth_profile_trigger.sql` for automated profile creation upon Better Auth user insert), transactional connection pooling via `postgres` driver, and multi-stage container deployment (`Dockerfile` runner and migrate targets, `compose.yml`).
- **Authentication & Email**: Deployed email/password authentication, session management, password reset flow, email verification banner and resend flow, and Resend transactional HTTP mail delivery.
- **UX Improvements**: Delivered email-first registration form with progressive password validation and nickname formatting, plus non-gating profile verification status.
- **Documentation & Showcase**: Reorganized canonical documentation under `docs/product-specs/`, `docs/design-docs/`, and `docs/references/`, updated the top-level README with architectural badges and instructions, and added the official repository showcase screenshot.
- **Strict Delivery Boundaries**: Delivered via normal merge commits with preserved branch ancestry. `origin/main` remained frozen at `aeb0dda1749e84a531d8fbfb863e8cd610f94f00`; no promotion to `main` or production deployment was performed.

### Deviations from Design

- **Size Exception for PR #48**: PR #48 cutover diff totaled 6,193 authored lines (4,684 additions, 1,509 deletions), exceeding the standard 600-line limit. This deviation was explicitly pre-authorized by the repository owner to prevent creating unstable, temporary dual-provider shims across runtime routes, guards, and database schemas.
- **Preservation of Windows Line Endings**: Added `*.sh text eol=lf` to `.gitattributes` during PR #45 preparation to prevent CRLF line endings on Windows checkouts breaking containerized Linux shell execution in Docker.
- **Tool Git Write Permissions in Baseline Phase**: The initial develop synchronization (PR #43) required manual execution of git restore/commit by the owner due to tool permission denial; all subsequent delivery operations for PRs #44–#51 proceeded cleanly in the isolated temporary worktree.

### Validation

Validation executed on the completed codebase tree (candidate for PR #51, docs/showcase diffs only):

- **Unit & Component Tests**: 95 test files / 811 tests passed cleanly via `vitest run`.
  - *Informational notices*: Vitest ESM config loader warning (`vitest.config.ts`) and jsdom `scrollTo()` not implemented are expected nonblocking test environment notices.
- **Static Analysis & Linting**: ESLint passed across all files with 0 errors and 0 warnings.
- **Type Checking**: Strict TypeScript validation passed via `next typegen` followed by `tsc --noEmit` with 0 type errors.
- **Production Build**: Native Next.js production build (`next build`) compiled successfully with all static and dynamic route configurations validated.
- **Integration Tests**: 86 tests passed (8 opt-in TMDB tests skipped as expected without live API credentials) running against an isolated local PostgreSQL container (`butaca-migration-dev-pg`).
- **End-to-End Tests**: 19 Playwright tests passed running against the production Next.js server instance with the isolated test database and local-only mock preloads for TMDB and Resend.
- **Docker & Compose Verification**:
  - Multi-stage Dockerfile built both `runner` and `migrate` targets cleanly with no build args or embedded secrets.
  - Inspected final container runner image: verified zero runtime-secret environment variables leaked into image layers.
  - Docker Compose configuration validated quietly (`docker compose config`).
  - Migration check passed via `drizzle-kit check`.
- **Documentation Integrity**: Verified all local Markdown cross-links resolved cleanly across all 31 Markdown files in the repository.
- **Independent Engineering Review**: PR #48 cutover underwent independent review and received a PASS verdict with two nonblocking suggestions recorded below.

### Follow-up

- **PR #51 Merge**: The final README/showcase/documentation PR was merged to `develop` by normal merge commit after candidate validation. The exact resulting commit is available in the GitHub merge record; no promotion PR was opened.
- **Nonblocking Reviewer Suggestions**:
  1. *Legacy Trigger String*: In `src/db/migrations/0001_auth_profile_trigger.sql`, the user fallback string `'Film Match user'` remains from early prototypes. A future migration can standardize this default display string if desired.
  2. *Readiness Query Cancellation*: In `src/app/api/ready/route.ts`, `Promise.race` times out after 2 seconds on probe timeout, but does not abort the underlying driver query; query termination relies on the PostgreSQL connection pool's 15-second statement timeout. Future refinement could inject an AbortSignal into the database query client when supported.
- **Main Promotion & Production**: Promotion of `develop` to `main` and production deployment remain strictly deferred and require separate owner authorization.
- **Technical Debt Tracking**: Concrete debt items TD-001 (Vitest loader warning), TD-002 (Better Auth concurrent registration error mapping), and TD-003 (Motion animation test timer contention under load) remain tracked in `docs/exec-plans/tech-debt-tracker.md`. No new debt tracker entries were created for the nonblocking reviewer suggestions.
