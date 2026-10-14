# Restore develop to the main baseline

## Objective and authorization

Owner approved restoring the tracked content of `develop` to current `main` via a normal PR/merge, preserving history and a backup. Do not force-push, change main, deploy, or mix the pending migration/documentation/UI work into this synchronization.

## Context

- Repository: `nanonoir/butaca`.
- Fetched `origin` before inspection.
- Frozen main: `aeb0dda1749e84a531d8fbfb863e8cd610f94f00`.
- Frozen develop: `4763d79916cb2f839b318e8c6b2a32ca4dd85b9c`.
- History divergence: main-only 2 commits, develop-only 3 commits.
- Restoration diff: 10 authored code/test files, +16 / -518 = 534 lines, within the 600-line coherent-PR budget. No generated or documentation exclusions needed.
- GitHub permits merge commits and has no open PRs targeting develop at inspection time.
- Current working directory remains on `feat/postgresql-better-auth` with existing uncommitted migration, registration UX, README/image and owner documentation reorganization. Preserve all of it.

## Execution

- [x] Inspect status, fresh remote references, divergence and delivery scope.
- [x] Preserve develop in a named backup branch locally and remotely.
- [x] Use a separate clean worktree and a branch based on frozen develop.
- [x] Restore the full tracked tree from frozen main, inspect staged paths and prove tree equality.
- [x] Commit, record frozen main as an ancestor via a normal same-tree merge, validate and independently review the exact restoration.
- [x] Push synchronization branch, create PR to develop, verify required checks/rules and merge normally.
- [x] Fetch and verify remote develop content equals frozen main; confirm main and the owner's pending work are unchanged.
- [x] Prepare a measured proposal for chained migration delivery (proposal only) and archive this plan.

## Validation and safety

No database or production operations. No force pushes, resets in the dirty working directory, Git clean or stashing owner work. The restoration intentionally discards develop-only file content but retains its history and backup. Any branch-protection or concurrent-ref changes must be handled without bypass.

After committing the restored tree, merge the frozen main commit normally into
the synchronization branch (both trees are already identical). This records main
ancestry without modifying its ref or changing any files, avoiding a misleading
merge-base when the later migration is eventually promoted from develop to main.

## Outcome

Completed. Remote backup
`backup/develop-before-main-20261014` points to the frozen develop commit. Clean
worktree: `C:/Users/Nahuel/AppData/Local/Temp/opencode/butaca-develop-main-baseline-20261014`,
branch `chore/develop-main-baseline-20261014`.

The shell denied `git restore --source=<frozen-main> --staged --worktree -- .`
in that clean worktree. The owner performed that exact step manually; no bypass
was attempted. Independently rechecked index tree `c4d87fdc274a60bef19925f868b0d23250416045`
equals frozen main, all ten staged paths match the expected 534-line restoration,
and the isolated worktree has no unstaged changes. Remote main/develop/backup
references still match the recorded SHAs.

Validation passed in the isolated worktree: frozen-lockfile installation, 84 unit
files / 702 tests (`vitest --maxWorkers=2`), full ESLint, Next typegen + strict
TypeScript, and production build with explicitly fake environment values and no
live database/integration execution. Independent read-only review: PASS.

The next shell call (`git commit` followed by the normal same-tree ancestry
merge) was also denied. The owner performed both manually: restoration commit
`5c199bb` and ancestry merge `9e278125aca73e708a9ca3e2858e4f2208a99532`.
Rechecked clean worktree, exact main tree and main ancestry before pushing.

## Completed synchronization

- PR: https://github.com/nanonoir/butaca/pull/43 — merged normally into develop.
- Merge commit: `2dff74eaae5384fd716b7b2f7af309b602088556`.
- Post-merge `origin/main` remains `aeb0dda1749e84a531d8fbfb863e8cd610f94f00`.
- Both remote branch trees are `c4d87fdc274a60bef19925f868b0d23250416045`;
  `git diff origin/main origin/develop` is empty and main is an ancestor of develop.
- Backup remains `backup/develop-before-main-20261014` at `4763d79916cb2f839b318e8c6b2a32ca4dd85b9c`.
- GitHub PR reported MERGEABLE/CLEAN, no checks and no applicable protection
  rules or required reviews. Used normal `gh pr merge --merge --match-head-commit`,
  never admin/force or a bypass. The PR diff was verified as +16/-518 = 534 authored lines.
- Pending-work preservation: compared status, sizes and modification timestamps
  for all 185 previously recorded paths (excluding this task's own plan): zero
  differences. Primary worktree remains `feat/postgresql-better-auth`, unstaged.

## Proposed next delivery (not yet executed or approved)

Start the first feature branch at the new origin/develop and each following
branch at its predecessor. Do not move/reset the dirty original worktree.

1. Documentation reorganization only: preserve baseline-accurate content and
   move implementation-specific updates into their corresponding feature PRs.
2. Inactive Resend transport, operational DB errors and PostgreSQL bootstrap role
   script with related tests (about 355 authored lines in current files).
3. Add pinned Better Auth dependencies while retaining Supabase until cutover;
   add inactive identity schema, config/rate-limiter modules/tests and shared
   password ceiling constant (approximately 286 authored lines before final hunk accounting).
4. Add inactive Better Auth engine, mail context, provider port and tests
   (543 lines in current new files; singleton runtime wiring stays with cutover).
5. Atomic runtime cutover: service/factory, contracts/reset UI/callbacks, proxy,
   baseline/FKs, environment/Docker/readiness, test harness replacement and
   Supabase removal. Related technical docs ship here. This still exceeds 600
   authored lines and needs an explicit size exception before PR creation;
   measure the actual branch diff, including renames/generated-file evidence,
   rather than treating all current untracked lines as a final PR measurement.
6. Registration UX and its tests/spec update (current code diff about 258 lines).
7. Non-gating profile verification status/retry and related tests/docs (about 164 lines).
8. README/showcase image and final documentation/validation reconciliation (0 code lines).

These are proposed coherent units, not validated intermediate commits. Verify
lint/typecheck/unit/build on each prepared branch; run isolated integration/E2E
at cutover and on the complete develop result. Do not claim the exploratory
all-inactive grouping was executable: readiness depends on the new error contract
and environment/proxy changes, so belongs with activation. Avoid temporary
dual-provider behavior solely to satisfy line budgets.

Use merge commits to preserve chain ancestry; retarget each next PR to develop
after its predecessor merges, and remeasure its own diff. No migration PRs,
main promotion or deployment are authorized by this synchronization execution.

## Implementation Outcome

### Implemented

- **Develop-to-Main Synchronization**: Restored the tracked tree of `develop` to exactly match frozen `main` (`aeb0dda1749e84a531d8fbfb863e8cd610f94f00`). Both remote branches now share identical tree SHA `c4d87fdc274a60bef19925f868b0d23250416045` with zero diff (`git diff origin/main origin/develop` is empty).
- **History & Ancestry Preservation**: Recorded `main` as an ancestor of `develop` via a normal same-tree ancestry merge (`9e278125aca73e708a9ca3e2858e4f2208a99532`), avoiding artificial divergence for subsequent promotion.
- **Safety Backup**: Created and preserved remote and local backup branch `backup/develop-before-main-20261014` at frozen develop commit `4763d79916cb2f839b318e8c6b2a32ca4dd85b9c`.
- **Delivery via GitHub PR #43**: Opened PR #43 (https://github.com/nanonoir/butaca/pull/43) with an exact 534-authored-line diff across 10 files (+16 / -518). Cleanly merged at 2026-10-14T17:11:29Z into develop (`2dff74eaae5384fd716b7b2f7af309b602088556`) using normal `gh pr merge --merge --match-head-commit` with no bypasses or forced admin overrides.
- **Worktree & Unstaged State Isolation**: The primary repository working directory on `feat/postgresql-better-auth` (185 pending paths) was verified completely untouched (matching status, sizes, and mtimes before and after). Isolated operations were performed in clean temp worktree `C:/Users/Nahuel/AppData/Local/Temp/opencode/butaca-develop-main-baseline-20261014`.
- **Proposed Migration Delivery Strategy**: Prepared a structured 8-unit chained delivery proposal for owner review (docs reorganization baseline, inactive utilities [~355 lines], identity/config [~286 lines], inactive Better Auth engine [~543 lines], atomic cutover with pending size exception, registration UX [~258 lines], profile verification [~164 lines], and showcase README docs [0 code lines]), preserving independent testability and chain ancestry.

### Deviations from Design

Tool Git write permissions were denied for working-tree modification commands (`git restore`, `git commit`, `git merge`). Per safety protocol, no permissions bypass was attempted; the repository owner manually executed the working tree restore, commit `5c199bb`, and same-tree merge `9e278125aca73e708a9ca3e2858e4f2208a99532` in the clean temporary worktree. Exact tree equality and clean state were re-verified independently before orchestrator push and PR merge.

### Validation

- **Tree Equality & History**: Verified `origin/main` (`aeb0dda1749e84a531d8fbfb863e8cd610f94f00`) and post-merge `origin/develop` (`2dff74eaae5384fd716b7b2f7af309b602088556`) both point to tree `c4d87fdc274a60bef19925f868b0d23250416045` with 0 diff, and `main` is an ancestor of `develop`.
- **Baseline Quality Suite**: Executed in clean worktree with dummy environment (no real DB / integration / production execution):
  - Vitest: 84 unit test files / 702 tests passed (`vitest --maxWorkers=2`).
  - ESLint: Full repository pass.
  - TypeScript: Next typegen + strict `tsc --noEmit` pass.
  - Production Build: Next.js `next build` pass.
- **Independent Review**: Read-only review session `ses_ec49f4afeffeBu7BO2iDuXIECQ` resulted in PASS with zero blocking issues.
- **GitHub PR Status**: Branch unprotected, no rules, status checks, or reviews required; PR reported MERGEABLE/CLEAN.
- **Integrity of Pending Work**: Compared status, sizes, and mtimes across all 185 uncommitted paths on `feat/postgresql-better-auth` before and after operations; confirmed zero modifications.

### Follow-up

- **Owner Discussion Strategy**: The 8-unit chained delivery plan is delivered solely as a proposal for owner discussion and is NOT approved for execution on future branches.
- **Size Exception for Cutover**: Unit 5 (atomic runtime cutover) is projected to exceed the 600-line PR threshold and requires an explicit owner exception before opening its PR, based on actual Git diff measurement (including file deletions and renames).
- **Readiness Coupling**: Readiness probe (`GET /api/ready`) depends on runtime error contracts and environment/proxy changes, so it belongs strictly with activation in unit 5 rather than earlier inactive units.
- **Temporary Worktree & Backup**: Temporary worktree `C:/Users/Nahuel/AppData/Local/Temp/opencode/butaca-develop-main-baseline-20261014` remains clean and intact for owner terminal audit; backup branch `backup/develop-before-main-20261014` is intentionally retained locally and remotely.
