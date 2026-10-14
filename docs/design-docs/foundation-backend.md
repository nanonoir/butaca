# Design: Foundation Backend

## 1. Goal

Build the backend infrastructure consumed by Butaca features: Supabase PostgreSQL with Drizzle ORM, Supabase Auth for identity and sessions, database migrations, repository layer, and the TMDB integration adapter with caching.

## 2. Boundaries

```text
Route Handler / Server Action
        ↓
Application Service
        ↓
Repository / Adapter
        ↓
Supabase (Auth + PostgreSQL) / TMDB API
```

## 3. Key Architectural Decisions

### 3.1 Server-Only Persistence
- Drizzle is the sole database access layer. React components and Route Handlers never import SQL tables or database clients directly; they consume repositories via application services.
- Supabase Data API is disabled. RLS is enabled on all tables without policies and `anon` / `authenticated` privileges are revoked, so authorization is explicit in the server: every private repository method filters by `userId`.

### 3.2 Database Connection & Migration Separation
- `DATABASE_URL`: Runtime connection through the Supabase transaction pooler (`prepare: false`).
- `DATABASE_MIGRATION_URL`: Direct session-mode connection used exclusively by Drizzle Kit. `parseServerEnv` does not read it, so the runtime cannot use it by accident.

### 3.3 Supabase Auth Identity
- Supabase Auth manages identity in `auth.users`. `public.users.id` reuses that UUID through a foreign key (`ON DELETE CASCADE`) added in custom migration `0001`, so Drizzle never manages the `auth` schema.
- `AuthService.getCurrentUser()` resolves identity with `getClaims()`, validates `claims.sub`, and loads the profile from `public.users`. It never uses `getSession()` and never accepts a client-provided `userId`.
- `src/proxy.ts` renews the session and applies route guards; a failing profile lookup never unlocks product routes.

### 3.4 Shared Contracts as Single Source of Truth
- Zod schemas in `src/contracts/` define domain boundaries and DTO shapes.
- TMDB adapter normalizes external provider responses and strictly validates them against shared contracts before exposing them to the application.
- Persistence types are inferred directly from Drizzle schema definitions (`$inferSelect`, `$inferInsert`).

### 3.5 Disposable Movie Cache
- `movie_cache` stores serialized movie detail payloads keyed by `(movie_id, language)`.
- TTL is 24 hours. Expired or corrupt payloads are discarded and refreshed from TMDB.
- Write or cache cleanup failures degrade gracefully without blocking successful TMDB fetches.

### 3.6 Migrations
- `0000_foundation_schema`, `0001_foundation_security` (custom), `0002_independent_watched_state`, `0003_plain_dagger`. Applied migrations are never edited; changes ship as new migrations.
