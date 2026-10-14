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

1. [ ] Documentation organization, with baseline-accurate current behavior. Feature-specific updates follow their code.
2. [ ] Inactive Resend transport, DB operational-error utilities and PostgreSQL app-role bootstrap, with tests.
3. [ ] Add pinned Better Auth dependencies (retain Supabase until cutover), inactive identity schema/config/rate limiter and tests, shared password ceiling constant.
4. [ ] Inactive Better Auth engine, mail context and provider port, with tests. Runtime singleton wiring stays with cutover.
5. [ ] Atomic runtime cutover: service/factory, HTTP/token/guard/proxy, baseline/FKs, environment/Docker/readiness, test replacement and Supabase removal. Related docs included. **Owner-approved size exception**: this coupled unit exceeds 600 authored lines; disclose measured size in its PR. Do not fabricate temporary dual-provider behavior to reduce the count.
6. [ ] Registration email-first/nickname/progressive-feedback UX, tests and spec.
7. [ ] Non-gating profile email-verification status/retry UX, tests and docs.
8. [ ] README/showcase image and final documentation/reconciliation/validation evidence.

Other units must stay within 600 manually authored additions+deletions, including tests/config/manual SQL. Exclude docs, lockfile and demonstrably generated snapshots/SQL, not entire arbitrary extensions. Report exclusions and renames explicitly.

## Verification

- Lint, Next type generation/TypeScript, unit tests and build before each PR. Use bounded workers and fake build configuration on Supabase baseline states.
- At cutover and on complete develop: isolated PostgreSQL integration, E2E, production/Docker builds and migration checks; no private application env fallback.
- Independent review of cutover and final chain coherence. No admin/force/bypassed requirements.
- Confirm final remote develop matches the intended approved source plus deliberate delivery documentation changes; original pending work remains preserved.

## Decisions, evidence and outcome

In progress. The earlier baseline worktree's restore/commit/merge writes were denied by tools and performed manually by the owner. Never bypass an actual denial; if necessary request permission resolution for the authorized new delivery writes.
