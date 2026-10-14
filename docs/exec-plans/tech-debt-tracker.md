# Technical Debt Tracker

This file tracks concrete, verifiable technical debt identified in the codebase.
Do not add speculative ideas, wishlist items, or vague suggestions. Each entry must describe a concrete issue, its impact, and references to relevant code.

## Active Technical Debt

### TD-001: Vite Native Config Loader Warning in Vitest
- **Discovered**: 2026-08 (Foundation Backend / Testing setup)
- **Location**: `vitest.config.ts`, `package.json`
- **Description**: Running `vitest run` outputs a warning: `ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a .mjs extension or set "type": "module" in package.json`. Vitest currently defaults to loading CommonJS when `"type": "module"` is not in `package.json`.
- **Impact**: Non-blocking cosmetic warning in test output. Future Vitest / Vite major versions may require `.mjs` or `"type": "module"`.
- **Remediation**: Rename `vitest.config.ts` to `vitest.config.mjs` (and `vitest.integration.config.ts` to `vitest.integration.config.mjs`) or evaluate full project ESM compatibility before setting `"type": "module"`.

### TD-002: Better Auth Wrapper Error Mapping on Concurrent Duplicate Registrations
- **Discovered**: 2026-10-14 (PostgreSQL & Better Auth Migration)
- **Location**: `src/features/auth/server-auth-service.ts`, `src/app/api/(auth)/register/route.ts`
- **Description**: When concurrent registration attempts occur with the same email, the losing database transaction triggers a unique constraint violation (`23505`). Better Auth's internal `signUpEmail` implementation catches this exception and re-throws `FAILED_TO_CREATE_USER` without preserving the underlying constraint cause. As a result, the auth boundary can return HTTP 503 (`AUTH_UNAVAILABLE`) rather than HTTP 409 (`EMAIL_ALREADY_REGISTERED`).
- **Impact**: Limited edge-case UX inconsistency during concurrent registration race conditions (returns 503 instead of 409). Data uniqueness and identity/profile integrity remain completely intact and verified by integration tests.
- **Remediation**: Re-evaluate whether future Better Auth versions preserve the cause or expose a dedicated collision code, so confirmed duplicate race losers can be mapped to `EMAIL_ALREADY_REGISTERED` without misclassifying other creation failures.

### TD-003: Vitest Motion Exit Transition Timer Contention Under Multi-Process Builds
- **Discovered**: 2026-10-14 (PostgreSQL & Better Auth Migration)
- **Location**: `src/features/discovery/discover-screen.test.tsx`
- **Description**: One full-suite run concurrent with native Next.js and Docker builds exceeded the real-timer Motion exit assertion deadline in `discover-screen.test.tsx` (805 passed / 1 failed). A subsequent run with `vitest --maxWorkers=2` passed (806 tests), as did the independent reviewer's default-worker run. CPU contention is consistent with these observations, not a separately measured root cause.
- **Impact**: An intermittent test assertion under concurrent build load; no runtime regression was observed and production builds pass.
- **Remediation**: Keep worker concurrency bounded (`--maxWorkers=2`) during heavy automated CI/multi-build environments, or advance fake timers explicitly in animation tests if test isolation warrants it.

### TD-004: Readiness Probe Timeout Does Not Cancel the Database Query
- **Discovered**: 2026-10-14 (PostgreSQL & Better Auth Migration review)
- **Location**: `src/app/api/ready/route.ts`
- **Description**: The readiness handler uses `Promise.race` to return after a 2-second timeout, but the losing database query continues running. It relies on the PostgreSQL connection pool's 15-second statement timeout to terminate the query; the probe timeout itself does not cancel it.
- **Impact**: Timed-out readiness checks can occupy a database connection until the statement timeout, potentially reducing pool capacity during database degradation.
- **Remediation**: If supported by the database client, pass an `AbortSignal` to the query and abort it when the readiness timeout elapses; otherwise document and validate the bounded pool-level timeout behavior.

### TD-005: Legacy Default Display Name in Profile-Creation Trigger
- **Discovered**: 2026-10-14 (PostgreSQL & Better Auth Migration review)
- **Location**: `src/db/migrations/0001_auth_profile_trigger.sql`
- **Description**: The profile-creation trigger uses the fallback display name `Film Match user`, which is a legacy prototype label rather than the current product name.
- **Impact**: Accounts that rely on this fallback may display inconsistent branding.
- **Remediation**: Standardize the fallback in a future migration if this default remains user-visible and product requirements call for the current brand.
