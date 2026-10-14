# Design: Foundation Backend

## 1. Goal

Build the backend infrastructure consumed by Butaca features: PostgreSQL with Drizzle ORM, Better Auth for identity and sessions, transactional email via Resend, database migrations, repository layer, and the TMDB integration adapter with caching.

## 2. Boundaries

```text
Route Handler / Server Action
        ↓
Application Service
        ↓
Repository / Adapter
        ↓
PostgreSQL / Better Auth / Resend / TMDB API
```

## 3. Key Architectural Decisions

### 3.1 Server-Only Persistence
- Drizzle is the sole database access layer. React components and Route Handlers never import SQL tables or database clients directly; they consume repositories via application services.
- PostgreSQL runs in a private Docker network without public port exposure.
- Application runtime connects with a non-superuser role (`butaca_app`), enforcing tenant isolation in application repositories by qualifying queries with `userId`.

### 3.2 Database Connection & Migration Separation
- `DATABASE_URL`: Runtime connection string used by Next.js with the non-superuser application role (`butaca_app`).
- `DATABASE_MIGRATION_URL`: Direct connection used exclusively by migration tooling (Drizzle Kit CLI and Docker `migrate` service) with the schema owner role (`butaca_owner`). The runtime web container does not receive owner credentials.

### 3.3 Explicit Auth Flow
- Better Auth manages identity (`auth_user`), credentials (`auth_account`), sessions (`auth_session`), and tokens (`auth_verification`).
- `public.users.id` directly reuses the UUID from `auth_user.id` (`ON DELETE CASCADE`), avoiding artificial translation layers.
- PostgreSQL trigger `auth_user_create_profile` creates the matching `public.users` profile row in the identity insertion transaction; its function and definition live in `src/db/migrations/0001_auth_profile_trigger.sql`.
- `getCurrentUser()` reads session identity using Better Auth (`auth.api.getSession`) and verifies `session.user.id` against `public.users`. It never accepts a client-provided `userId`.
- Password reset uses an explicit single-use token with expiration. Email verification is non-gating for login and onboarding.
- Transactional emails are dispatched via Resend HTTP API.

### 3.4 Shared Contracts as Single Source of Truth
- Zod schemas in `src/contracts/` define domain boundaries and DTO shapes.
- TMDB adapter normalizes external provider responses and strictly validates them against shared contracts before exposing them to the application.
- Persistence types are inferred directly from Drizzle schema definitions (`$inferSelect`, `$inferInsert`).

### 3.5 Disposable Movie Cache
- `movie_cache` stores serialized movie detail payloads keyed by `(movie_id, language)`.
- TTL is 24 hours. Expired or corrupt payloads are discarded and refreshed from TMDB.
- Write or cache read failures degrade gracefully without blocking successful TMDB fetches.
