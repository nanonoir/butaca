# PostgreSQL and Better Auth migration

## Objective

Restore Butaca using a fresh self-managed PostgreSQL database, Better Auth, and Resend, preserving the domain and existing UX with only approved authentication contract changes.

## Context and references

- `docs/generated/butaca-migracion-supabase-a-postgresql-better-auth.md`
- `ARCHITECTURE.md`, `docs/PLANS.md`
- Owner approval of 2026-10-14 supersedes the original PRD: no historical import, automated backups/restore infrastructure, demo accounts, or production access/deployment.
- Discovery baseline: 84 unit test files / 702 tests, ESLint and TypeScript passed. Integration/E2E require isolation before execution.

## Scope

Development only. Preserve Drizzle, UUID domain relationships, profile ownership, HTTP envelopes and UI except explicit reset token, operational `SERVICE_UNAVAILABLE` (503), and minimal email-verification UX. Email verification must not gate onboarding. Use conventional database sessions and standard provider protections. No custom session system, Redis, extra persistent services, or production operations.

## Execution plan

- [x] Discovery and owner approval.
- [x] Reconcile PRD and capture precise technical decisions.
- [x] Brief isolated spike: fixed Better Auth versions, UUIDs, sessions/cookies and identity/profile integrity.
- [x] Archive legacy migrations intact and create one portable migration chain for fresh PostgreSQL.
- [x] Integrate Better Auth and Resend behind application services; preserve contracts and implement approved token/reset and verification changes.
- [x] Prepare private PostgreSQL Compose, explicit migration tooling, runtime-only secrets, liveness/readiness, and safe test isolation.
- [x] Replace Supabase-dependent tests/helpers and remove operational packages/configuration.
- [x] Validate unit, integration, E2E, lint, TypeScript, production build and Docker behavior where available.
- [x] Independent review and focused corrections.
- [x] Reconcile documentation and pending DNS verification; archive this development implementation plan. Git delivery is deferred by the owner.

## Decisions and deviations

- Candidate dependency versions: `better-auth@1.7.7` and official Drizzle adapter `1.7.7`; pin only after runtime validation.
- Separate `auth_user` identity from `users` profile, same UUID. Prefer minimal SQL initial-profile trigger if isolated tests demonstrate correctness. Do not use an after-hook as an unproven shared transaction.
- Verification emails are sent after registration without requiring verification for onboarding/login. Preserve automatic sign-in. Provider owns verification/reset token lifecycle.
- Use Resend HTTP API with the configured runtime key, sender `Butaca <no-reply@butaca.lat>`, and canonical production URLs `https://butaca.lat`. No build-time secrets or deployment-time mail activation flag. DNS/provider verification remains external and may block real delivery, not implementation.
- Retain accepted password validation; introduce no new business rules. Any necessary provider length compatibility must be explicit and tested.
- Existing uncommitted documentation reorganization and `pnpm-lock.yaml` changes are owner work and must not be reverted or silently included in commits.
- Git delivery was deferred during the implementation session for manual review and baseline comparison. It was subsequently delivered through owner-approved PRs #44–#51 into `develop` on 2026-10-14 using normal merge commits; `main` remained unchanged. No production operations were performed.
- Preserve the existing review description minimum of 3: both `src/contracts/reviews.ts` and the latest archived migration explicitly use 3–400. An old integration assertion still expected 10; corrected only that test to 2-invalid/3-valid. The pre-existing 10–400 documentation discrepancy must not silently change domain behavior during this migration.
- Better Auth's default maximum password length (128) conflicts with the accepted existing contract. A shared `PASSWORD_POLICY.MAX_LENGTH=1024` now aligns Zod and the provider; overlong new passwords produce a precise field validation message. Existing complexity/minimum rules remain unchanged. This compatibility bound avoids silently adopting 72 or 128.
- Server-side `auth.api` did not enforce the expected HTTP-origin checks in execution. All six auth mutation routes now have a small shared fail-closed HTTP guard: exact canonical Origin, same-origin Fetch Metadata when present, and JSON for body-bearing endpoints. No provider CSRF/origin protection is disabled.
- Resend retry is available to an unverified signed-in user in Profile → Account. Delivery failure does not invalidate the account or gate onboarding; retry reports an explicit failure rather than success. Production-provider logging discards raw messages/arguments to avoid session-token/PII leakage.

## Validation and verification

Integration/E2E used an explicitly selected isolated local test database. Never load private application environment by default; never log secrets, connection strings, cookies, reset links or tokens. No destructive operations on existing databases.

- Docker Desktop was stopped. Started the local `desktop-linux` engine (named-pipe endpoint); no pre-existing running containers were present.
- Created task-owned PostgreSQL 17 containers only: `butaca-migration-dev-pg` (loopback ephemeral port, isolated test database), and Compose project `butaca-migration-compose` (private network, fresh volume). Generated test credentials live outside the repository in the approved temporary directory.
- `SELECT 1` passed on the isolated test database. Compose PostgreSQL became healthy; bootstrap initialization produced `butaca_app` with `rolsuper=false`, `rolcreatedb=false`, and `rolcreaterole=false`.
- Resend read-only domain metadata returned HTTP 401 using the available private configuration. No message was sent and no credential was printed. Domain-specific DKIM and live delivery remain unverified; see `docs/references/resend-dns.md`.
- Environment module focused validation from implementation: 14 tests passed; ESLint passed; Compose `config --quiet` passed with generated dummy configuration; init script shell syntax passed.
- Applied the new baseline using `drizzle-kit migrate` to the guarded, isolated `butaca_migration_test` database: passed.
- First full integration run: 79 passed, one obsolete review-length expectation failed, 8 live-TMDB tests skipped (no live credentials). After the focused correction, all 29 repository tests passed. The auth suite already passed real UUID/profile/credential/session/cookie/reset/verification assertions against PostgreSQL.
- Intermediate full unit run: 94 files / 769 tests passed (before removal of the obsolete Supabase proxy test and later verification-retry additions).
- Full `next typegen && tsc --noEmit` and ESLint passed after removing all unused Supabase integrations/public env and both Supabase packages.
- Finalized integration suite: 84 passed / 8 live-TMDB tests explicitly skipped. External Resend/TMDB calls in the E2E server are intercepted by an opt-in test-only Node preload guarded by local test DB configuration; the preload is excluded from Docker images.
- Intermediate full unit suite: 95 files / 800 tests passed after the origin, availability and logging corrections. New review-fix tests were added afterward.
- Full E2E: 19 passed (10.6s), real Next/Better Auth/PostgreSQL with fixture-only external providers. Initial E2E had two stale URL assertions expecting the token to remain visible; corrected assertions to verify the deliberate address-bar token removal. No production code was weakened.
- Native production build passed. Docker build passed without runtime secrets or Supabase variables after two genuine build fixes: exclude Playwright config when its test imports are absent from Docker context, and resolve Next request headers before runtime auth initialization to prevent build-time secret validation.
- Docker migration image built and applied the baseline with the owner role. An app-role identity insert created exactly one linked profile in the same transaction; probe rolled back. Compose recreated PostgreSQL while retaining its volume and a linked fixture survived (then was cleaned up).
- Compose web health and readiness returned 200; invalid login returned 401. With only the task-owned PostgreSQL stopped, health stayed 200 (76ms), readiness returned 503 (3015ms), and readiness recovered to 200 after restart.
- Image inspection found zero runtime-secret environment keys and no Supabase env. Running container had Resend/Better Auth runtime keys and no owner-password variable. Values were never printed.
- A subsequent full unit run concurrent with both builds hit an unrelated real-timer Motion exit assertion in `discover-screen.test.tsx` (805 passed / 1 failed). Revalidate after builds without concurrent heavy work; do not modify unrelated product animation.
- Final full unit run after builds: `node node_modules/vitest/vitest.mjs run --maxWorkers=2` — **95 files / 806 tests passed**. Full ESLint and `next typegen && tsc --noEmit` also passed. The independent reviewer separately reported 806 tests passing with the default runner. No unrelated animation code was changed.
- Final full integration run: **86 passed / 8 opt-in live-TMDB skipped**. Added real-DB checks for a fresh auth instance recovering an existing session, rejecting database expiry, and exactly one concurrent reset-token consumer.
- Final full E2E against the rebuilt native production server: **19 passed (11.4s)**. Real PostgreSQL/auth/session/domain with test-only provider fixtures; no production sends or silent application mocks.
- Final native `next build` and Docker runner `pnpm build` passed after review corrections. The task Compose web was recreated from the final image and became healthy.
- `drizzle-kit check` passed. All four archived legacy SQL files and all five journal/snapshot files match their original Git HEAD content (normalizing line endings only).
- Local Docker idle observation only (not a VPS load benchmark): web about 95 MiB, PostgreSQL about 25.45 MiB with its 512 MiB cap. No production resource claims are made.
- Independent focused re-review: **PASS**, no material residual findings. The concurrent-duplicate registration loser may receive 503 rather than 409; uniqueness and identity/profile integrity are tested and intact. Track this limited UX inconsistency without custom adapter infrastructure.
- Cleanup: stopped the verified task-owned E2E Node process and both task-owned PostgreSQL stacks/web container; removed the task-only email outbox/PID artifact. Volumes and generated isolated development credential files were retained outside Git. No pre-existing application processes, databases, or production services were touched.

## Implementation outcome

### Implemented

- **Core Migration & Engine**: Eliminated all runtime dependencies on Supabase Auth, client SDKs, and pooler connections. Migrated to a self-managed PostgreSQL 17 database service, Better Auth 1.7.7 with official Drizzle adapter, and Resend transactional email over HTTP API.
- **Identity & Domain Profile Integrity**: Authentication identities (`auth_user`) and domain profiles (`public.users`) share a UUID. Trigger `auth_user_create_profile` creates the profile in the identity insertion transaction; its failure rolls back that insertion. The FK prevents profiles without identities. Direct out-of-band profile deletion can still leave a missing profile, which login repairs idempotently; this is not a claim of bidirectional deletion enforcement.
- **Authentication Endpoints & Envelopes**: Preserved all existing frontend endpoints (`/api/register`, `/api/login`, `/api/logout`, `/api/forgot-password`, `/api/reset-password`, `/confirm`), response envelopes, and UX.
- **HTTP Origin Protection**: Added the shared fail-closed HTTP guard `src/features/auth/auth-request.ts` to all six auth mutation routes, validating canonical Origin, Fetch Metadata and JSON for body-bearing endpoints. The separate `route-guard.ts` still owns navigation/onboarding decisions.
- **Token Lifecycle & Operational Statuses**:
  - Password reset uses explicit, single-use, expiring tokens passed via `/reset-password?token=...`. The frontend clears the token from the browser address bar immediately upon mount to prevent leakage.
   - Operational DB failures in domain APIs return `SERVICE_UNAVAILABLE/503`; auth endpoints retain `AUTH_UNAVAILABLE/503`. Neither exposes internal credentials or stack traces.
- **Email Verification & Resend**:
  - Verification emails are dispatched upon registration via Resend HTTP API (`Butaca <no-reply@butaca.lat>`).
  - Verification is non-gating: auto-signin after registration is preserved, and unverified users are neither blocked from logging in nor from completing onboarding.
  - Users can resend verification emails from Profile (`/profile`).
- **Database & Docker Architecture**:
  - Dedicated PostgreSQL 17 Bookworm service in a private internal Docker network without public 5432 exposure, limited to 512 MiB memory, with persistent volume `postgres-data`.
  - Application connects with dedicated unprivileged role `butaca_app` (`rolsuper=false`, `rolcreatedb=false`, `rolcreaterole=false`).
  - Portable baseline migrations (`0000_initial_schema.sql` and `0001_auth_profile_trigger.sql`) executed by a separate Docker `migrate` service with schema owner privileges (`butaca_owner`).
  - Distinct liveness (`GET /api/health` 200 process-only) and readiness (`GET /api/ready` testing `SELECT 1` with 3s bounded timeout, returning 200 or 503) probes.
- **Clean Cleanup & Zero Secrets**:
   - Removed both Supabase packages, proxy adapters and public environment configuration. Legacy SQL and metadata remain intact in `src/db/archive/supabase-migrations/`.
  - Zero build-time secrets or production keys baked into Docker image layers. Runtime secrets passed strictly via runtime environment.

### Deviations from Design

1. **HTTP Origin Guard on Server Auth Routes**:
   Better Auth's server-side `auth.api` methods bypass browser origin validation when called directly from Next.js Route Handlers. Implemented an explicit fail-closed origin guard across the 6 mutation routes to enforce canonical origin, fetch metadata, and content types.
2. **Password Length Alignment (Max 1024)**:
   Better Auth defaults to a 128-character maximum password length, which conflicted with Butaca's accepted password contract. Aligned Zod and provider options using `PASSWORD_POLICY.MAX_LENGTH = 1024` without weakening complexity or minimum requirements.
3. **Database Profile Trigger instead of Application Hook**:
   Rather than relying on asynchronous or unverified after-hooks in Better Auth that could lead to orphan records upon connection failure, atomic 1:1 profile generation was implemented as a PostgreSQL trigger in `0001_auth_profile_trigger.sql`.
4. **Review Description Length (3–400)**:
   Reconciled pre-existing documentation discrepancies (`AGENTS.md` and `contracts.md` originally stated 10–400, while canonical code `src/contracts/reviews.ts` and legacy migration `0003_plain_dagger.sql` enforced 3–400). Preserved the active 3–400 rule in code and baseline migration `0000_initial_schema.sql`, corrected only the outdated integration test expectation, and updated documentation without introducing behavioral regressions.
5. **No Historical Data Import or Backup Infrastructure**:
   Per explicit owner approval on 2026-10-14, historical user accounts, passwords, and sessions from Supabase were not imported, and automated backup/restore infrastructure was excluded for this development phase.
6. **External DNS & Email Delivery Verification**:
   During development, the read-only Resend domain metadata request (`GET /domains`) returned HTTP 401 without body inspection or sending attempts, indicating that the configured API key may be restricted to sending rather than being invalid for delivery. Live inbox delivery was therefore not tested, and the public DKIM record must be copied from the Resend web console. Email delivery will activate automatically upon DNS verification by the owner on 2026-10-15 and provision of a key authorized for send, without requiring code rebuild or redeploy.
 7. **Git Delivery Deferred During Implementation**:
    Staging, commits, push, PRs and merge were postponed during the implementation session. The owner later approved the baseline synchronization and an eight-PR chain; PRs #44–#51 merged into `develop` on 2026-10-14. This did not change `main` or authorize production operations.

### Validation

- **Unit Tests**: 95 test files, 806 passed (`node node_modules/vitest/vitest.mjs run --maxWorkers=2`).
- **Static Quality & Typecheck**: ESLint clean, `pnpm typecheck` (`next typegen && tsc --noEmit`) clean with zero errors.
- **Integration Tests**: 86 passed, 8 opt-in TMDB live tests omitted (`pnpm test:integration`). Included new tests for fresh session recovery from DB, session rejection on DB expiry, and single-use concurrent reset token consumption.
- **E2E Tests**: 19 passed in 11.4s with Playwright against the production Next.js build running with Better Auth + PostgreSQL (external Resend/TMDB intercepted via test-only preload, excluded from Docker context).
- **Builds**: Native production build (`next build`) and Docker container build (`pnpm build`) both passed without any secrets in image layers.
- **Docker Compose & Resilience**:
  - `migrate` container ran baseline migrations successfully using owner role (`butaca_owner`).
  - App insertion trigger tested with rollback probe verifying atomic 1:1 profile generation.
  - PostgreSQL container recreated retaining persistent volume; survived restart.
  - Failures simulated: with PostgreSQL stopped, liveness `GET /api/health` returned 200 (76ms), readiness `GET /api/ready` returned 503 (3015ms), and recovered to 200 upon restart.
  - Image inspection confirmed 0 runtime secret keys baked into images and 0 Supabase environment variables.
  - Idle resource consumption on local development machine observed at ~95 MiB (web) and ~25.45 MiB (postgres).
- **Independent Review**: Independent reviewer (`ses_ec65f6577ffe7MQNjSu2zfA4sk`) issued PASS on focused re-review with zero material blocking issues.

### Follow-up

- **External Resend DNS Verification & Delivery Confirmation**:
  Domain administrator to add MX (`feedback-smtp.sa-east-1.amazonses.com`, priority 10), SPF TXT (`v=spf1 include:amazonses.com ~all`), and DKIM TXT (copied from Resend dashboard) for `butaca.lat` on 2026-10-15. Confirm live email delivery once DNS records are active and verify runtime key sending permissions.
- **Technical Debt TD-002**:
  Better Auth error wrapping on concurrent duplicate registrations returns HTTP 503 instead of HTTP 409 because Better Auth swallows the underlying unique constraint violation cause. Uniqueness and data integrity remain intact.
- **Technical Debt TD-003**:
  Under parallel heavy loads (such as concurrent Docker and native builds), Motion UI transition timers in Vitest can experience thread contention. `vitest --maxWorkers=2` is recommended during multi-process builds.
- **Git Delivery Outcome**:
  The approved chain completed through PR #51 into `develop`. Promotion from `develop` to `main` remains a separate owner decision, and production migration/deployment remains out of scope.
