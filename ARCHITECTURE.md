# Architecture

## 1. Architectural Style & Boundaries

Butaca is designed as a **Modular Monolith** adhering to strict vertical separation of concerns:

```text
Route Handler / Server Action (Presentation & Routing)
        ↓
Application Service (Domain & Orchestration)
        ↓
Repository / Integration Adapter (Persistence & External Providers)
```

### Invariants:
- **No business logic in UI or routes**: React components, Server Components, and Next.js Route Handlers strictly delegate domain logic and orchestration to application services.
- **Explicit authentication & user boundaries**: No endpoint accepts a client-provided `userId`. The user identity is extracted server-side through Supabase Auth `getClaims()` (`AuthService.getCurrentUser()`) and passed down to repositories explicitly. `getSession()` is never used to authorize.
- **Single source of truth for contracts**: Zod schemas (`src/contracts/`) define canonical input/output types. All TypeScript types are inferred using `z.infer`. Never duplicate contract types manually.
- **Provider isolation**: External integrations and providers (Supabase and TMDB) are isolated within `src/integrations/`. No provider-specific types, raw URLs, or SDK calls leak into React components or Application Services.

---

## 2. Directory Layout & Module Responsibilities

```text
src/
├── app/            # Next.js App Router (Routes, API route handlers, layouts, server actions)
├── components/     # Reusable UI primitives (src/components/ui) and shared shell layout (src/components/shared)
├── contracts/      # Shared Zod schemas and inferred TypeScript types (Canonical DTOs)
├── db/             # Database layer: Drizzle schemas, migrations, and repository implementations
├── features/       # Domain modules (auth, discovery, recommendations, onboarding, movies, profile, likes, reviews)
├── fixtures/       # Validated fixtures and dev/test data
├── integrations/   # External provider clients and adapters (Supabase clients/session proxy, TMDB adapter)
└── lib/            # Shared cross-cutting utilities (environment parsers, API route helpers)
```

---

## 3. Data & Persistence Architecture

### 3.1 Database Technology
- **Engine**: Supabase-managed PostgreSQL. Auth and the application database are the same Supabase project.
- **ORM & Migrations**: Drizzle ORM (`drizzle-orm`) and Drizzle Kit (`drizzle-kit`).
- **Connection Strategy**:
  - `DATABASE_URL`: Runtime connection through the Supabase pooler (transaction mode); the client is created with `prepare: false`.
  - `DATABASE_MIGRATION_URL`: Direct (session mode) connection used only by `drizzle-kit`.

### 3.2 Public Tables & Invariants
- `users`: Profile entity. PK `id` reuses `auth.users(id)` (UUID) through a foreign key with `ON DELETE CASCADE`, added by custom migration `0001`.
- `user_preferences`: User genre tastes. Must contain at least 2 positive genre IDs.
- `user_movie_interactions`: User reaction (`LIKE` / `DISLIKE`, nullable) and `watchedAt` timestamp. Reaction and watched state are independent; at least one must be present. Unique constraint on `(user_id, movie_id)`.
- `reviews`: User movie review with verdict (`RECOMMENDED` / `NOT_WORTH_IT`), title (3–30 chars), and description (3–400 chars). Unique constraint on `(user_id, movie_id)`.
- `movie_cache`: Disposable global cache for TMDB movie details keyed by `(movie_id, language)`. TTL of 24 hours.

### 3.3 Security & Access Boundary
- Supabase Data API is disabled; there is no REST/GraphQL surface over `public`.
- Row Level Security is enabled on all five tables with **no policies**, and `anon` / `authenticated` have all privileges revoked (migration `0001`).
- The runtime reaches the database only through server-side Drizzle; tenant isolation is enforced in repositories by qualifying every private query with `userId`.

---

## 4. Key Integrations

### 4.1 Supabase Auth & Identity
- Supabase Auth owns identity (`auth.users`), credentials, sessions, and email flows (email + password).
- `AuthService` resolves identity with `getClaims()` and validates `claims.sub` as a UUID; a user present in `auth.users` without a `public.users` row raises `UserProfileNotProvisionedError`.
- `src/proxy.ts` renews the session on every request (`src/integrations/supabase/proxy.ts`) and applies the route guard fail-closed, including onboarding gating.
- Password and form rules live in [`docs/product-specs/auth-flow.md`](./docs/product-specs/auth-flow.md).

### 4.2 TMDB API
- Acts as the canonical movie catalog (`movieId: number` from TMDB).
- `TmdbClient` handles raw HTTP calls, authentication, and error normalization into `TmdbError`.
- `TmdbAdapter` translates provider responses into canonical contracts (`MovieSummary`, `MovieDetail`, `Genre`, etc.), normalizes dates, selects trailers, and orchestrates `movie_cache`.

### 4.3 Recommendation Engine
- Pure Content-Based Filtering for the MVP.
- Orchestrates:
  ```text
  Preferences + Likes + Dislikes → Taste Profile → Candidate Generation → Local Ranking → Discover
  ```
- TMDB may generate candidates via Discover/Similar endpoints; our application owns final ranking.

### 4.4 AI Assistant (Buti)
- Built with AI SDK (`@ai-sdk/google`, `ai`).
- Operates over the recommendation service; does not reinvent independent recommendation algorithms.
- Chat conversations are ephemeral in the MVP (unpersisted).
