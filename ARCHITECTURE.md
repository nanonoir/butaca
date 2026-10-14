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
- **Explicit authentication & user boundaries**: No endpoint accepts a client-provided `userId`. The user identity is extracted server-side via Better Auth sessions (`auth.api.getSession` / `AuthService.getCurrentUser()`) and passed down to repositories explicitly.
- **Single source of truth for contracts**: Zod schemas (`src/contracts/`) define canonical input/output types. All TypeScript types are inferred using `z.infer`. Never duplicate contract types manually.
- **Provider isolation**: External integrations and providers (Better Auth, Resend, and TMDB) are completely isolated within `src/integrations/`. No provider-specific types, raw URLs, or SDK calls leak into React components or Application Services.

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
├── integrations/   # External provider clients and adapters (Better Auth, Resend HTTP client, TMDB adapter)
└── lib/            # Shared cross-cutting utilities (environment parsers, API route helpers)
```

---

## 3. Data & Persistence Architecture

### 3.1 Database Technology
- **Engine**: PostgreSQL 17 self-managed in Docker container (internal network, no public port).
- **ORM & Migrations**: Drizzle ORM (`drizzle-orm`) and Drizzle Kit (`drizzle-kit`).
- **Connection Strategy**:
  - `DATABASE_URL`: Runtime connection used by Next.js via the non-superuser application role (`butaca_app`).
  - `DATABASE_MIGRATION_URL`: Direct connection used by the migration container target or `drizzle-kit` via the owner role (`butaca_owner`).

### 3.2 Public Tables & Invariants
- `users`: Profile entity. PK `id` directly matches Better Auth `auth_user(id)` UUID with `ON DELETE CASCADE`. Synchronized atomically on `auth_user` creation via PostgreSQL trigger.
- `user_preferences`: User genre tastes. Must contain at least 2 positive genre IDs.
- `user_movie_interactions`: User reaction (`LIKE` / `DISLIKE`) and `watchedAt` timestamp. Reaction and watched state are independent. Unique constraint on `(user_id, movie_id)`.
- `reviews`: User movie review with verdict (`RECOMMENDED` / `NOT_WORTH_IT`), title (3–30 chars), and description (3–400 chars). Unique constraint on `(user_id, movie_id)`.
- `movie_cache`: Disposable global cache for TMDB movie details keyed by `(movie_id, language)`. TTL of 24 hours.

### 3.3 Security & Role Isolation
- PostgreSQL runs in a private internal Docker network without exposing port 5432 to the host.
- Application runtime connects using a dedicated non-superuser role (`butaca_app`) with minimal privileges.
- Schemas and migrations are owned by `butaca_owner`.
- Tenant isolation is strictly enforced in application repositories by qualifying queries with `userId`.

---

## 4. Key Integrations

### 4.1 Better Auth & Identity
- Better Auth handles user identity (`auth_user`), credentials (`auth_account`), sessions (`auth_session`), and tokens (`auth_verification`).
- Passwords are securely hashed by Better Auth; password policy enforces minimum 8, maximum 1024 characters with complexity checks.
- Middleware / Proxy (`src/proxy.ts`) and server-side route guards validate sessions and protect routes fail-closed.
- Reset password uses explicit single-use tokens with expiration; email verification is non-gating for login and onboarding.
- Transactional emails (verification and password reset) are dispatched via Resend HTTP API (`Butaca <no-reply@butaca.lat>`).

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
