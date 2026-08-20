# Foundation Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la Foundation Backend de Film Match con Auth server-side, PostgreSQL/Drizzle, cinco repositorios, integración TMDB y cache de detalle, sin implementar features de producto.

**Architecture:** El runtime mantiene dos fronteras: `Application Service -> Repository -> Drizzle/PostgreSQL` y `Application Service -> TmdbAdapter -> TmdbClient -> TMDB`. Supabase Auth resuelve identidad y sesión; `public.users.id` reutiliza el UUID de `auth.users`, mientras que la autorización de datos privados se conserva explícita mediante `userId` en servicios y filtros SQL.

**Tech Stack:** Next.js 16.3.1, TypeScript 5, Zod 4, Supabase SSR/JS, Drizzle ORM/Kit, PostgreSQL vía `postgres`, Vitest 4 y `fetch` nativo.

---

## 0. Alcance congelado y precondiciones

### Incluido

- Environment server-side y separación runtime/migraciones.
- Supabase browser/server clients, Proxy de renovación y `AuthService` para email/contraseña.
- Tablas `users`, `user_preferences`, `user_movie_interactions`, `reviews` y `movie_cache`.
- Repositorios de persistencia para esas cinco tablas.
- `getGenres`, `searchMovies`, `getMovieDetail`, `discoverMovies` y `getSimilarMovies`.
- Cache de `getMovieDetail`, errores TMDB normalizados y tests unitarios/integración.
- Documentación operativa y atribución TMDB.

### Excluido

- Rutas de negocio, Server Actions, pantallas, onboarding, Discover, Likes, Review UI y swipe.
- Recommendation Engine, Taste Profile, ranking, Chat/LLM, watchlist, series, embeddings y pgvector.
- Policies RLS de acceso desde navegador, acceso Data API y cualquier segundo algoritmo de recomendación.

### Precondiciones externas antes de la integración real

En el worktree no existen actualmente `.env.local` ni `.env.integration.local`. Antes de ejecutar las tareas que abren conexiones reales, el desarrollador debe crear ambos archivos sin versionarlos:

```dotenv
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
DATABASE_URL=
DATABASE_MIGRATION_URL=
TMDB_ACCESS_TOKEN=
```

```dotenv
# .env.integration.local
SUPABASE_TEST_SECRET_KEY=
```

El proyecto Supabase de desarrollo debe tener email/contraseña habilitado, confirmación de email desactivada para la suite local y Data API desactivada. Ningún paso debe imprimir valores de estas variables.

### Referencias primarias verificadas

- Supabase SSR y `getClaims()`: <https://supabase.com/docs/guides/auth/server-side/creating-a-client>
- FK desde una tabla pública hacia `auth.users`: <https://supabase.com/docs/guides/auth/managing-user-data>
- Migraciones generated/custom de Drizzle Kit: <https://orm.drizzle.team/docs/drizzle-kit-generate>
- TMDB Search, Discover, Detail y Similar: <https://developer.themoviedb.org/reference/search-movie>, <https://developer.themoviedb.org/reference/discover-movie>, <https://developer.themoviedb.org/reference/movie-details> y <https://developer.themoviedb.org/reference/movie-similar>
- Atribución TMDB: <https://developer.themoviedb.org/docs/faq>

## 1. Mapa final de archivos

```text
drizzle.config.ts
vitest.config.ts
vitest.integration.config.ts
.env.example
package.json
README.md
docs/foundation-backend.md
src/
  proxy.ts
  lib/env/
    public.ts
    server.ts
    migration.ts
    __tests__/env.test.ts
  db/
    client.ts
    index.ts
    schema/
      enums.ts
      users.ts
      user-preferences.ts
      user-movie-interactions.ts
      reviews.ts
    movie-cache.ts
    relations.ts
    index.ts
    __tests__/schema.test.ts
  migrations/
      0000_foundation_schema.sql
      0001_foundation_security.sql
      meta/
    repositories/
      user-repository.ts
      user-preferences-repository.ts
      user-movie-interaction-repository.ts
      review-repository.ts
      movie-cache-repository.ts
      index.ts
      __tests__/movie-cache-repository.test.ts
  features/auth/
    auth-service.ts
    errors.ts
    index.ts
    __tests__/auth-service.test.ts
  integrations/supabase/
    client.ts
    server.ts
    proxy.ts
    index.ts
    __tests__/proxy.test.ts
  integrations/tmdb/
    config.ts
    client.ts
    adapter.ts
    errors.ts
    schemas/
      common.ts
      movie-list.ts
      movie-detail.ts
      index.ts
    index.ts
    __tests__/
      client.test.ts
      adapter.test.ts
      cache.test.ts
  fixtures/tmdb/
    genres.json
    movie-list.json
    movie-detail.json
tests/integration/
  setup-env.ts
  support/
    env.ts
    database.ts
    supabase.ts
  database-schema.integration.test.ts
  repositories.integration.test.ts
  auth.integration.test.ts
  tmdb.integration.test.ts
```

## Phase A — Configuración y persistencia

### Task 1: Ampliar el runner y validar el environment sin filtrar secretos

**Files:**

- Create: `src/lib/env/public.ts`
- Create: `src/lib/env/server.ts`
- Create: `src/lib/env/migration.ts`
- Create: `src/lib/env/__tests__/env.test.ts`
- Modify: `vitest.config.ts`
- Modify: `.env.example`
- Modify: `package.json`

- [x] **Step 1: Escribir pruebas RED del parser**

La prueba debe cubrir valores válidos, ausencia de una variable, URL inválida y separación de `DATABASE_MIGRATION_URL`:

```ts
import { describe, expect, it } from "vitest";

import { parseMigrationEnv } from "../migration";
import { parseServerEnv } from "../server";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  DATABASE_URL: "postgresql://runtime.example/db",
  DATABASE_MIGRATION_URL: "postgresql://migration.example/db",
  TMDB_ACCESS_TOKEN: "tmdb-test-token",
};

describe("environment parsers", () => {
  it("returns only validated runtime values", () => {
    expect(parseServerEnv(valid)).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: valid.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      DATABASE_URL: valid.DATABASE_URL,
      TMDB_ACCESS_TOKEN: valid.TMDB_ACCESS_TOKEN,
    });
  });

  it("reports a missing key without including another secret value", () => {
    const { TMDB_ACCESS_TOKEN: _removed, ...missingToken } = valid;
    expect(() => parseServerEnv(missingToken)).toThrow("TMDB_ACCESS_TOKEN");
    expect(() => parseServerEnv(missingToken)).not.toThrow(
      "sb_publishable_test",
    );
  });

  it("rejects an invalid Supabase URL", () => {
    expect(() =>
      parseServerEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" }),
    ).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("parses only the migration URL for Drizzle Kit", () => {
    expect(parseMigrationEnv(valid)).toEqual({
      DATABASE_MIGRATION_URL: valid.DATABASE_MIGRATION_URL,
    });
  });
});
```

- [x] **Step 2: Ejecutar la prueba y comprobar RED**

Run: `pnpm test:run src/lib/env/__tests__/env.test.ts`

Expected: FAIL porque `../server` y `../migration` todavía no existen.

- [x] **Step 3: Implementar schemas Zod separados**

`public.ts` debe exponer `parsePublicEnv(source)` y `getPublicEnv()`. `server.ts` debe reutilizar el schema público, aceptar sólo `DATABASE_URL` y `TMDB_ACCESS_TOKEN` además de las variables públicas, y lanzar un error que enumere únicamente paths inválidos. `migration.ts` debe conocer exclusivamente `DATABASE_MIGRATION_URL`.

```ts
const formatInvalidKeys = (error: z.ZodError) =>
  [...new Set(error.issues.map((issue) => issue.path.join(".")))].join(", ");

export function parseServerEnv(source: NodeJS.ProcessEnv) {
  const result = ServerEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    DATABASE_URL: source.DATABASE_URL,
    TMDB_ACCESS_TOKEN: source.TMDB_ACCESS_TOKEN,
  });

  if (!result.success) {
    throw new Error(
      `Invalid server environment: ${formatInvalidKeys(result.error)}`,
    );
  }

  return result.data;
}
```

`getServerEnv()` debe usar cache de módulo y rechazar `typeof window !== "undefined"`. Ningún módulo debe serializar el objeto completo en errores o logs.

- [x] **Step 4: Ampliar Vitest a todo `src/`**

```ts
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["tests/integration/**"],
    passWithNoTests: true,
  },
});
```

Actualizar `.env.example` para agregar `DATABASE_MIGRATION_URL` y conservar sin cambios las variables AI ya existentes. Hacer reproducible el typecheck desde un checkout limpio, donde todavía no existe `.next/types`:

```json
{
  "typecheck": "next typegen && tsc --noEmit"
}
```

`next typegen` pertenece a Next.js 16.3.1 y genera `LayoutProps` sin exigir un build previo.

- [x] **Step 5: Ejecutar GREEN y controles estáticos**

Run: `pnpm test:run src/lib/env/__tests__/env.test.ts && pnpm typecheck && pnpm lint`

Expected: 4 tests PASS; typecheck y lint exit 0.

- [x] **Step 6: Commit**

```bash
git add .env.example package.json vitest.config.ts src/lib/env
git commit -m "chore(foundation): validate backend environment"
```

### Task 2: Definir las cinco tablas, enums, checks, índices y relaciones

**Files:**

- Create: `src/db/schema/enums.ts`
- Create: `src/db/schema/users.ts`
- Create: `src/db/schema/user-preferences.ts`
- Create: `src/db/schema/user-movie-interactions.ts`
- Create: `src/db/schema/reviews.ts`
- Create: `src/db/schema/movie-cache.ts`
- Create: `src/db/schema/relations.ts`
- Create: `src/db/schema/index.ts`
- Delete: `src/db/schema/.gitkeep`

- [x] **Step 1: Escribir un test estático RED del schema exportado**

Create `src/db/schema/__tests__/schema.test.ts` y comprobar nombres de tabla, enums y claves primarias con `getTableConfig`:

```ts
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  movieCache,
  movieReactionEnum,
  reviewVerdictEnum,
  reviews,
  userMovieInteractions,
  userPreferences,
  users,
} from "..";

describe("foundation database schema", () => {
  it("exports exactly the five public tables", () => {
    expect(
      [users, userPreferences, userMovieInteractions, reviews, movieCache].map(
        (table) => getTableConfig(table).name,
      ),
    ).toEqual([
      "users",
      "user_preferences",
      "user_movie_interactions",
      "reviews",
      "movie_cache",
    ]);
  });

  it("uses only the approved enum values", () => {
    expect(movieReactionEnum.enumValues).toEqual(["LIKE", "DISLIKE"]);
    expect(reviewVerdictEnum.enumValues).toEqual([
      "RECOMMENDED",
      "NOT_WORTH_IT",
    ]);
  });
});
```

- [x] **Step 2: Ejecutar RED**

Run: `pnpm test:run src/db/schema/__tests__/schema.test.ts`

Expected: FAIL porque el barrel del schema todavía no existe.

- [x] **Step 3: Implementar enums y columnas con tipos inferidos**

Usar `timestamp` con `withTimezone: true` y `mode: "date"`, además de `defaultNow()` y `$inferSelect/$inferInsert`. `users.id` es PK sin UUID alternativo ni `auth_user_id`; la FK a `auth.users` se agrega en la migración custom de Task 3 para que Drizzle no administre el schema interno de Supabase.

```ts
export const movieReactionEnum = pgEnum("movie_reaction", ["LIKE", "DISLIKE"]);
export const reviewVerdictEnum = pgEnum("review_verdict", [
  "RECOMMENDED",
  "NOT_WORTH_IT",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    displayName: varchar("display_name", { length: 80 }).notNull(),
    avatarUrl: text("avatar_url"),
    onboardingCompletedAt: timestamp("onboarding_completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "users_display_name_length_check",
      sql`char_length(btrim(${table.displayName})) between 1 and 80`,
    ),
  ],
);

export type UserRecord = typeof users.$inferSelect;
export type NewUserRecord = typeof users.$inferInsert;
```

Aplicar el mismo patrón de nombres a las demás tablas: `UserPreferenceRecord`, `NewUserPreferenceRecord`, `UserMovieInteractionRecord`, `NewUserMovieInteractionRecord`, `ReviewRecord`, `NewReviewRecord`, `MovieCacheRecord` y `NewMovieCacheRecord`.

Las demás tablas deben respetar esta matriz exacta:

| Tabla                     | PK/unique                                            | Checks                                                                   | Índices no unique                                                     |
| ------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `user_preferences`        | PK `user_id`                                         | `cardinality(preferred_genre_ids) >= 2` y `0 < ALL(preferred_genre_ids)` | ninguno adicional                                                     |
| `user_movie_interactions` | UUID PK default random; unique `(user_id, movie_id)` | `movie_id > 0`                                                           | `(user_id, updated_at desc)` y `(user_id, reaction, updated_at desc)` |
| `reviews`                 | UUID PK default random; unique `(user_id, movie_id)` | `movie_id > 0`, título trim 3..30, descripción trim 10..400              | `(movie_id, created_at desc)` y `(movie_id, verdict)`                 |
| `movie_cache`             | PK compuesta `(movie_id, language)`                  | `movie_id > 0`, idioma trim 2..10                                        | `(fetched_at)`                                                        |

Todas las FK públicas hacia `users.id` usan `onDelete: "cascade"`. No agregar tablas, triggers ni columnas fuera del diseño.

- [x] **Step 4: Declarar relaciones Drizzle sin lógica de negocio**

`relations.ts` debe conectar `users` con preferencias, interacciones y reviews; `movie_cache` queda global y sin relación a usuarios. `schema/index.ts` reexporta tablas, enums y relaciones.

- [x] **Step 5: Ejecutar GREEN y typecheck**

Run: `pnpm test:run src/db/schema/__tests__/schema.test.ts && pnpm typecheck`

Expected: tests PASS y typecheck exit 0.

- [x] **Step 6: Commit**

```bash
git add src/db/schema
git commit -m "feat(foundation): define database schema"
```

### Task 3: Generar migraciones reproducibles y aplicar seguridad Supabase

**Files:**

- Create: `drizzle.config.ts`
- Modify: `package.json`
- Create: `src/db/migrations/0000_foundation_schema.sql`
- Create: `src/db/migrations/0001_foundation_security.sql`
- Create: `src/db/migrations/meta/_journal.json`
- Create: `src/db/migrations/meta/0000_snapshot.json`
- Create: `src/db/migrations/meta/0001_snapshot.json`
- Delete: `src/db/migrations/.gitkeep`

- [x] **Step 1: Configurar Drizzle Kit con la URL exclusiva de migraciones**

```ts
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

import { parseMigrationEnv } from "./src/lib/env/migration";

config({ path: ".env.local", quiet: true });
const env = parseMigrationEnv(process.env);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: { url: env.DATABASE_MIGRATION_URL },
  strict: true,
  verbose: true,
});
```

Agregar scripts:

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:check": "drizzle-kit check"
}
```

- [x] **Step 2: Generar la migración base**

Run: `pnpm db:generate -- --name foundation_schema`

Expected: Drizzle crea una migración con cinco tablas públicas y dos enums; no crea ni modifica `auth.users`.

- [x] **Step 3: Generar una migración custom para la frontera Supabase**

Run: `pnpm exec drizzle-kit generate --custom --name foundation_security`

Completar el SQL custom con:

```sql
ALTER TABLE "users"
  ADD CONSTRAINT "users_id_auth_users_id_fk"
  FOREIGN KEY ("id") REFERENCES "auth"."users"("id")
  ON DELETE CASCADE;

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_movie_interactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "movie_cache" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "users" FROM anon, authenticated;
REVOKE ALL ON TABLE "user_preferences" FROM anon, authenticated;
REVOKE ALL ON TABLE "user_movie_interactions" FROM anon, authenticated;
REVOKE ALL ON TABLE "reviews" FROM anon, authenticated;
REVOKE ALL ON TABLE "movie_cache" FROM anon, authenticated;
```

No crear policies: el runtime usa Drizzle server-side y la autorización se aplica antes de acceder al repositorio.

- [x] **Step 4: Validar la secuencia de migraciones**

Run: `pnpm db:check`

Expected: exit 0 sin colisiones ni migraciones desordenadas.

- [x] **Step 5: Aplicar contra Supabase de desarrollo**

Run: `pnpm db:migrate`

Expected: ambas migraciones se aplican una vez; una segunda ejecución finaliza sin repetir DDL.

- [x] **Step 6: Commit**

```bash
git add drizzle.config.ts package.json pnpm-lock.yaml src/db/migrations
git commit -m "feat(foundation): add reproducible database migrations"
```

### Task 4: Crear el cliente Drizzle y el harness de integración

**Files:**

- Create: `src/db/client.ts`
- Create: `src/db/index.ts`
- Create: `vitest.integration.config.ts`
- Create: `tests/integration/setup-env.ts`
- Create: `tests/integration/support/env.ts`
- Create: `tests/integration/support/database.ts`
- Create: `tests/integration/database-schema.integration.test.ts`
- Modify: `package.json`

- [x] **Step 1: Escribir una prueba de integración que inspeccione la DB real**

La prueba debe consultar `pg_tables`, `pg_type`, `pg_constraint`, `pg_indexes`, `pg_class.relrowsecurity` e `information_schema.role_table_grants`. Debe afirmar:

```ts
expect(publicTables).toEqual([
  "movie_cache",
  "reviews",
  "user_movie_interactions",
  "user_preferences",
  "users",
]);
expect(movieReactionValues).toEqual(["LIKE", "DISLIKE"]);
expect(reviewVerdictValues).toEqual(["RECOMMENDED", "NOT_WORTH_IT"]);
expect(tablesWithoutRls).toEqual([]);
expect(browserRoleGrants).toEqual([]);
expect(authForeignKeyDeleteAction).toBe("CASCADE");
```

- [x] **Step 2: Implementar el loader de integración con fallo explícito**

`setup-env.ts` carga `.env.local` y luego `.env.integration.local`. `support/env.ts` valida todas las variables requeridas, incluida `SUPABASE_TEST_SECRET_KEY`, y sólo informa nombres ausentes.

```ts
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.integration.test.ts"],
    setupFiles: ["./tests/integration/setup-env.ts"],
    fileParallelism: false,
    maxWorkers: 1,
  },
});
```

- [x] **Step 3: Implementar una factory cerrable para Drizzle**

```ts
export function createDatabaseConnection(databaseUrl: string) {
  const sqlClient = postgres(databaseUrl, { prepare: false });
  const db = drizzle(sqlClient, { schema });

  return {
    db,
    close: () => sqlClient.end(),
  };
}

export type Database = ReturnType<typeof createDatabaseConnection>["db"];
```

`getDatabase()` debe crear un singleton lazy con `DATABASE_URL`; los tests usan la factory y cierran siempre en `afterAll`.

- [x] **Step 4: Agregar el comando separado**

```json
{
  "test:integration": "vitest run --config vitest.integration.config.ts"
}
```

- [x] **Step 5: Ejecutar la inspección real**

Run: `pnpm test:integration -- database-schema.integration.test.ts`

Expected: PASS si Task 3 fue aplicada; si falta configuración, FAIL con los nombres de variables y sin valores.

- [x] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.integration.config.ts src/db/client.ts src/db/index.ts tests/integration
git commit -m "test(foundation): verify the real database schema"
```

## Phase B — Repositorios

### Task 5: Implementar `UserRepository` con identidad unificada

**Files:**

- Create: `src/db/repositories/user-repository.ts`
- Create: `src/db/repositories/index.ts`
- Create: `tests/integration/repositories.integration.test.ts`

- [x] **Step 1: Escribir casos RED para usuario**

Crear un usuario Auth temporal mediante el helper público de `tests/integration/support/supabase.ts`; probar:

```ts
it("creates and finds a profile using the Auth UUID");
it("updates only the requested profile fields");
it("returns null for an unknown UUID");
it("upsertFromAuthUser repairs a missing profile idempotently");
it("deleting the Auth user cascades to public.users");
```

El cleanup administrativo vive en `finally` y usa la secret sólo para `auth.admin.deleteUser`.

- [x] **Step 2: Ejecutar RED**

Run: `pnpm test:integration -- repositories.integration.test.ts`

Expected: FAIL porque `UserRepository` no existe.

- [x] **Step 3: Implementar la API exacta**

```ts
export type UserProfileInput = Pick<
  NewUserRecord,
  "id" | "displayName" | "avatarUrl"
>;

export type UserProfileUpdate = Partial<
  Pick<UserRecord, "displayName" | "avatarUrl" | "onboardingCompletedAt">
>;

export class UserRepository {
  constructor(private readonly db: Database) {}

  findById(userId: string): Promise<UserRecord | null>;
  create(input: UserProfileInput): Promise<UserRecord>;
  update(userId: string, input: UserProfileUpdate): Promise<UserRecord | null>;
  upsertFromAuthUser(input: UserProfileInput): Promise<UserRecord>;
}
```

`upsertFromAuthUser` usa `onConflictDoNothing({ target: users.id })` y luego devuelve la fila existente cuando el insert no produjo resultado. Así repara perfiles faltantes sin sobrescribir un nombre o avatar editado por el usuario.

- [x] **Step 4: Ejecutar GREEN**

Run: `pnpm test:integration -- repositories.integration.test.ts && pnpm typecheck`

Expected: casos de usuario PASS y typecheck exit 0.

- [x] **Step 5: Commit**

```bash
git add src/db/repositories tests/integration/repositories.integration.test.ts tests/integration/support/supabase.ts
git commit -m "feat(foundation): add user repository"
```

### Task 6: Implementar preferencias e interacciones preservando invariantes

**Files:**

- Create: `src/db/repositories/user-preferences-repository.ts`
- Create: `src/db/repositories/user-movie-interaction-repository.ts`
- Modify: `src/db/repositories/index.ts`
- Modify: `tests/integration/repositories.integration.test.ts`

- [x] **Step 1: Escribir pruebas RED de preferencias**

```ts
it("creates, reads, updates and upserts preferences scoped by userId");
it("rejects fewer than two preferred genres at the database boundary");
it("rejects non-positive preferred genre IDs at the database boundary");
```

- [x] **Step 2: Escribir pruebas RED de interacciones**

```ts
it("creates a LIKE with watchedAt null");
it("switches LIKE to DISLIKE without changing watchedAt");
it("setWatched updates an existing row and never creates one");
it("findLikesByUser and findDislikesByUser cannot return another user data");
it("deleting an interaction removes reaction and watchedAt together");
it("rejects a non-positive TMDB movie ID");
```

- [x] **Step 3: Ejecutar RED**

Run: `pnpm test:integration -- repositories.integration.test.ts`

Expected: FAIL por los repositorios ausentes.

- [x] **Step 4: Implementar firmas y filtros obligatorios**

```ts
export class UserPreferencesRepository {
  constructor(private readonly db: Database) {}

  findByUserId(userId: string): Promise<UserPreferenceRecord | null>;
  create(
    userId: string,
    preferredGenreIds: number[],
  ): Promise<UserPreferenceRecord>;
  update(
    userId: string,
    preferredGenreIds: number[],
  ): Promise<UserPreferenceRecord | null>;
  upsert(
    userId: string,
    preferredGenreIds: number[],
  ): Promise<UserPreferenceRecord>;
}

export class UserMovieInteractionRepository {
  constructor(private readonly db: Database) {}

  findByUserAndMovie(
    userId: string,
    movieId: number,
  ): Promise<UserMovieInteractionRecord | null>;
  findByUser(
    userId: string,
    page?: number,
  ): Promise<UserMovieInteractionRecord[]>;
  findLikesByUser(
    userId: string,
    page?: number,
  ): Promise<UserMovieInteractionRecord[]>;
  findDislikesByUser(
    userId: string,
    page?: number,
  ): Promise<UserMovieInteractionRecord[]>;
  upsertReaction(
    userId: string,
    movieId: number,
    reaction: MovieReaction,
  ): Promise<UserMovieInteractionRecord>;
  setWatched(
    userId: string,
    movieId: number,
    watchedAt: Date | null,
  ): Promise<UserMovieInteractionRecord | null>;
  delete(userId: string, movieId: number): Promise<boolean>;
}
```

Todos los `WHERE` privados incluyen `userId`. Las listas usan `PAGE_SIZE = 20`, offset `(page - 1) * PAGE_SIZE` y orden `updatedAt desc`. El `onConflictDoUpdate` de `upsertReaction` cambia sólo `reaction` y `updatedAt`; nunca incluye `watchedAt` en `set`.

- [x] **Step 5: Ejecutar GREEN**

Run: `pnpm test:integration -- repositories.integration.test.ts && pnpm typecheck`

Expected: preferencias e interacciones PASS.

- [x] **Step 6: Commit**

```bash
git add src/db/repositories tests/integration/repositories.integration.test.ts
git commit -m "feat(foundation): persist preferences and interactions"
```

### Task 7: Implementar reviews comunitarias y cache descartable

**Files:**

- Create: `src/db/repositories/review-repository.ts`
- Create: `src/db/repositories/movie-cache-repository.ts`
- Modify: `src/db/repositories/index.ts`
- Modify: `tests/integration/repositories.integration.test.ts`
- Create: `src/db/repositories/__tests__/movie-cache-repository.test.ts`

- [x] **Step 1: Escribir pruebas RED de reviews**

```ts
it("creates and finds one review per user and movie");
it("updates and deletes only when userId owns the review");
it("upserts without creating a duplicate review");
it("findByMovie returns community reviews with author data by page");
it("countByVerdict aggregates both approved verdicts");
it("enforces title and description lengths in PostgreSQL");
```

- [x] **Step 2: Escribir pruebas RED del TTL**

```ts
const entry = { fetchedAt: new Date("2026-08-18T10:00:00.000Z") };
const now = new Date("2026-08-19T09:59:59.999Z");

expect(isMovieCacheExpired(entry, 86_400_000, now)).toBe(false);
expect(
  isMovieCacheExpired(entry, 86_400_000, new Date("2026-08-19T10:00:00.000Z")),
).toBe(true);
```

- [x] **Step 3: Ejecutar RED**

Run: `pnpm test:run src/db/repositories/__tests__/movie-cache-repository.test.ts && pnpm test:integration -- repositories.integration.test.ts`

Expected: FAIL por módulos ausentes.

- [x] **Step 4: Implementar `ReviewRepository`**

```ts
export class ReviewRepository {
  constructor(private readonly db: Database) {}

  findById(reviewId: string): Promise<ReviewRecord | null>;
  findByUserAndMovie(
    userId: string,
    movieId: number,
  ): Promise<ReviewRecord | null>;
  findByMovie(movieId: number, page?: number): Promise<ReviewWithAuthor[]>;
  create(
    userId: string,
    movieId: number,
    input: ReviewWriteInput,
  ): Promise<ReviewRecord>;
  update(
    userId: string,
    reviewId: string,
    input: ReviewWriteInput,
  ): Promise<ReviewRecord | null>;
  upsert(
    userId: string,
    movieId: number,
    input: ReviewWriteInput,
  ): Promise<ReviewRecord>;
  delete(userId: string, reviewId: string): Promise<boolean>;
  countByVerdict(
    movieId: number,
  ): Promise<{ recommended: number; notWorthIt: number }>;
}
```

`ReviewWriteInput` se deriva con `Pick<NewReviewRecord, "verdict" | "title" | "description">`. El tipo compuesto conserva tipos inferidos de tabla sin duplicar campos de dominio:

```ts
export type ReviewWithAuthor = {
  review: ReviewRecord;
  author: Pick<UserRecord, "displayName" | "avatarUrl">;
};
```

No calcula `isMine` ni recommendation rate en el repositorio.

- [x] **Step 5: Implementar `MovieCacheRepository`**

```ts
export const MOVIE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function isMovieCacheExpired(
  entry: Pick<MovieCacheRecord, "fetchedAt">,
  ttlMs = MOVIE_CACHE_TTL_MS,
  now = new Date(),
) {
  return now.getTime() - entry.fetchedAt.getTime() >= ttlMs;
}

export class MovieCacheRepository {
  constructor(private readonly db: Database) {}

  get(movieId: number, language: string): Promise<MovieCacheRecord | null>;
  set(
    movieId: number,
    language: string,
    payload: unknown,
    fetchedAt?: Date,
  ): Promise<MovieCacheRecord>;
  delete(movieId: number, language: string): Promise<boolean>;
  isExpired(
    entry: Pick<MovieCacheRecord, "fetchedAt">,
    ttlMs?: number,
    now?: Date,
  ): boolean;
}
```

`set` usa upsert por `(movieId, language)`; el payload permanece `unknown` hasta validarse en la capa TMDB.

- [x] **Step 6: Ejecutar GREEN**

Run: `pnpm test:run src/db/repositories/__tests__/movie-cache-repository.test.ts && pnpm test:integration -- repositories.integration.test.ts && pnpm typecheck`

Expected: TTL, reviews y cache PASS.

- [x] **Step 7: Commit**

```bash
git add src/db/repositories tests/integration/repositories.integration.test.ts
git commit -m "feat(foundation): persist reviews and movie cache"
```

## Phase C — Supabase Auth

### Task 8: Crear clientes SSR y Proxy de renovación

**Files:**

- Create: `src/integrations/supabase/client.ts`
- Create: `src/integrations/supabase/server.ts`
- Create: `src/integrations/supabase/proxy.ts`
- Create: `src/integrations/supabase/index.ts`
- Create: `src/integrations/supabase/__tests__/proxy.test.ts`
- Create: `src/proxy.ts`
- Delete: `src/integrations/supabase/.gitkeep`

- [x] **Step 1: Escribir una prueba RED de renovación y cookies**

Mockear `createServerClient` y afirmar que `updateSession` llama `getClaims()` exactamente una vez, aplica cada cookie recibida mediante `setAll` al request y al response, y devuelve esa response. No usar un JWT real en este test.

- [x] **Step 2: Ejecutar RED**

Run: `pnpm test:run src/integrations/supabase/__tests__/proxy.test.ts`

Expected: FAIL porque `updateSession` todavía no existe.

- [x] **Step 3: Implementar el browser client con variables públicas**

```ts
export function createBrowserSupabaseClient() {
  const env = getPublicEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
```

- [x] **Step 4: Implementar el server client por request**

Usar `await cookies()` de Next.js 16 y la API `getAll/setAll` de `@supabase/ssr`. `setAll` intenta escribir cookies y tolera únicamente el caso de Server Component donde Next no permite mutación; Route Handlers, Server Actions y Proxy sí deben persistirlas.

- [x] **Step 5: Implementar `updateSession(request)`**

Crear `NextResponse.next({ request })`, copiar cada cookie tanto al request como al response, invocar exactamente `await supabase.auth.getClaims()` y devolver la misma response mutada. No usar `getSession()` para autorizar.

- [x] **Step 6: Conectar el Proxy de Next.js 16**

```ts
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

No proteger rutas de producto todavía; esta tarea sólo renueva y propaga sesión.

- [x] **Step 7: Ejecutar GREEN y verificar integración framework**

Run: `pnpm test:run src/integrations/supabase/__tests__/proxy.test.ts && pnpm typecheck && pnpm lint && pnpm build`

Expected: la prueba PASS, los tres controles exit 0 y Next reconoce `src/proxy.ts` sin advertencia de middleware legado.

- [x] **Step 8: Commit**

```bash
git add src/integrations/supabase src/proxy.ts
git commit -m "feat(foundation): configure Supabase SSR auth"
```

### Task 9: Implementar `AuthService` test-first y probar el flujo real

**Files:**

- Create: `src/features/auth/errors.ts`
- Create: `src/features/auth/auth-service.ts`
- Create: `src/features/auth/index.ts`
- Create: `src/features/auth/__tests__/auth-service.test.ts`
- Create: `tests/integration/auth.integration.test.ts`
- Delete: `src/features/auth/.gitkeep`

- [x] **Step 1: Escribir pruebas RED con dependencias controladas**

Cubrir:

```ts
it("signUp provisions public.users with the Auth UUID");
it(
  "signIn repairs a missing local profile without overwriting an existing one",
);
it("maps invalid credentials to InvalidCredentialsError");
it("getCurrentUser returns null when getClaims has no identity");
it("getCurrentUser validates claims.sub and loads users.id");
it(
  "getCurrentUser throws UserProfileNotProvisionedError for an Auth-only user",
);
it("requireCurrentUser throws UnauthenticatedError for a guest");
it("signOut maps provider failures without exposing provider payloads");
```

Los doubles implementan sólo `signUp`, `signInWithPassword`, `signOut` y `getClaims`; el repositorio fake implementa `findById` y `upsertFromAuthUser`.

- [x] **Step 2: Ejecutar RED**

Run: `pnpm test:run src/features/auth/__tests__/auth-service.test.ts`

Expected: FAIL porque `AuthService` no existe.

- [x] **Step 3: Implementar errores estables y la API del servicio**

```ts
export class InvalidCredentialsError extends Error {}
export class UnauthenticatedError extends Error {}
export class UserProfileNotProvisionedError extends Error {}
export class AuthProviderError extends Error {}

export class AuthService {
  constructor(
    private readonly auth: AuthClientPort,
    private readonly users: Pick<
      UserRepository,
      "findById" | "upsertFromAuthUser"
    >,
  ) {}

  signUp(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<UserRecord>;
  signIn(input: { email: string; password: string }): Promise<UserRecord>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<UserRecord | null>;
  requireCurrentUser(): Promise<UserRecord>;
}
```

Definir el puerto directamente desde el SDK instalado, sin crear un segundo wrapper:

```ts
type AuthClientPort = Pick<
  SupabaseClient["auth"],
  "signUp" | "signInWithPassword" | "signOut" | "getClaims"
>;
```

`signUp` guarda `display_name` en `options.data`, exige un Auth user y llama `upsertFromAuthUser`. `signIn` usa metadata `display_name` sólo para reparar una fila ausente; si no existe, deriva un nombre no vacío y máximo 80 desde el email. `getCurrentUser` usa `getClaims()`, valida `claims.sub` con `UuidSchema` y nunca acepta `userId` como input.

- [x] **Step 4: Ejecutar GREEN unitario**

Run: `pnpm test:run src/features/auth/__tests__/auth-service.test.ts && pnpm typecheck`

Expected: todos los casos Auth PASS.

- [x] **Step 5: Escribir y ejecutar la integración real**

La prueba usa email único, signup público, logout, signin público, `getCurrentUser` y cleanup administrativo en `finally`:

```ts
try {
  const created = await authService.signUp({ email, password, displayName });
  expect(created.id).toMatch(UUID_PATTERN);

  await authService.signOut();
  const signedIn = await authService.signIn({ email, password });
  expect(signedIn.id).toBe(created.id);
  await expect(authService.getCurrentUser()).resolves.toMatchObject({
    id: created.id,
  });
} finally {
  await deleteTestAuthUserByEmail(email);
}
```

Run: `pnpm test:integration -- auth.integration.test.ts`

Expected: PASS y ausencia del usuario tanto en `auth.users` como en `public.users` después del cleanup.

- [x] **Step 6: Commit**

```bash
git add src/features/auth tests/integration/auth.integration.test.ts
git commit -m "feat(foundation): add server-side auth service"
```

## Phase D — Integración TMDB

### Task 10: Implementar configuración, schemas crudos, cliente HTTP y errores

**Files:**

- Create: `src/integrations/tmdb/config.ts`
- Create: `src/integrations/tmdb/errors.ts`
- Create: `src/integrations/tmdb/schemas/common.ts`
- Create: `src/integrations/tmdb/schemas/movie-list.ts`
- Create: `src/integrations/tmdb/schemas/movie-detail.ts`
- Create: `src/integrations/tmdb/schemas/index.ts`
- Create: `src/integrations/tmdb/client.ts`
- Create: `src/integrations/tmdb/__tests__/client.test.ts`

- [x] **Step 1: Escribir pruebas RED del cliente**

Cubrir una request válida por operación y esta matriz de errores:

| Entrada                     | Código esperado    |
| --------------------------- | ------------------ |
| HTTP 401                    | `UNAUTHORIZED`     |
| HTTP 404                    | `NOT_FOUND`        |
| HTTP 429                    | `RATE_LIMITED`     |
| HTTP 500–599 o fallo de red | `UNAVAILABLE`      |
| AbortError por timeout      | `TIMEOUT`          |
| JSON o shape inválido       | `INVALID_RESPONSE` |

La prueba de request afirma header `Authorization: Bearer test-token`, `accept: application/json`, `language=es-AR`, `region=AR` sólo donde corresponde, `include_adult=false` en Search/Discover y `append_to_response=credits,keywords,videos` en Detail. Ningún mensaje de error puede contener `test-token`.

- [x] **Step 2: Ejecutar RED**

Run: `pnpm test:run src/integrations/tmdb/__tests__/client.test.ts`

Expected: FAIL por módulos ausentes.

- [x] **Step 3: Crear schemas privados Zod**

Inferir todos los tipos con `z.infer`. Los schemas mínimos deben validar:

```ts
TmdbMovieSummarySchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  original_title: z.string(),
  overview: z.string(),
  poster_path: z.string().nullable(),
  backdrop_path: z.string().nullable(),
  genre_ids: z.array(z.number().int().positive()),
  release_date: z.string(),
  original_language: z.string(),
  vote_average: z.number(),
  vote_count: z.number().int().min(0),
});
```

Detail agrega `tagline`, `runtime`, `genres`, `credits.cast`, `credits.crew`, `keywords.keywords` y `videos.results`, incluidos `site`, `type`, `official`, `iso_639_1` y `key`. No exportar estos tipos desde el barrel público de la aplicación.

- [x] **Step 4: Implementar `TmdbClient` inyectando `fetch`**

```ts
export type TmdbErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UNAVAILABLE"
  | "INVALID_RESPONSE";

export class TmdbError extends Error {
  constructor(
    public readonly code: TmdbErrorCode,
    public readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(`TMDB request failed: ${code}`, options);
    this.name = "TmdbError";
  }
}

export class TmdbClient {
  constructor(
    private readonly config: TmdbConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  getGenres(): Promise<TmdbGenresResponse>;
  searchMovies(input: {
    query: string;
    page: number;
  }): Promise<TmdbMovieListResponse>;
  getMovieDetail(movieId: number): Promise<TmdbMovieDetailResponse>;
  discoverMovies(input: TmdbDiscoverRequest): Promise<TmdbMovieListResponse>;
  getSimilarMovies(input: {
    movieId: number;
    page: number;
  }): Promise<TmdbMovieListResponse>;
}
```

`TmdbDiscoverRequest` es un tipo privado del proveedor y debe declararse completo junto al cliente:

```ts
export type TmdbDiscoverRequest = {
  page: number;
  withGenres?: string;
  withoutGenres?: string;
  withKeywords?: string;
  withCast?: string;
  withCrew?: string;
  withOriginalLanguage?: string;
  minRuntime?: number;
  maxRuntime?: number;
  minVoteAverage?: number;
  minVoteCount?: number;
};
```

El cliente traduce esos nombres a los query params TMDB documentados; el adapter nunca construye una URL.

Un helper privado construye `URLSearchParams`, un `AbortController` de 10 segundos, valida `response.ok`, parsea JSON y aplica el schema recibido. El `finally` siempre limpia el timer.

- [x] **Step 5: Ejecutar GREEN**

Run: `pnpm test:run src/integrations/tmdb/__tests__/client.test.ts && pnpm typecheck && pnpm lint`

Expected: requests y seis códigos de error PASS.

- [x] **Step 6: Commit**

```bash
git add src/integrations/tmdb
git commit -m "feat(foundation): add validated TMDB client"
```

### Task 11: Adaptar géneros, búsqueda y detalle a contratos compartidos

**Files:**

- Create: `src/fixtures/tmdb/genres.json`
- Create: `src/fixtures/tmdb/movie-list.json`
- Create: `src/fixtures/tmdb/movie-detail.json`
- Create: `src/integrations/tmdb/adapter.ts`
- Create: `src/integrations/tmdb/__tests__/adapter.test.ts`

- [x] **Step 1: Guardar fixtures mínimos válidos y anonimizados**

Los JSON reproducen shapes reales del proveedor pero no contienen tokens, URLs firmadas ni datos de usuario. `movie-detail.json` incluye más de 20 miembros de cast, más de 50 keywords, crew con dos directores potenciales y trailers con combinaciones YouTube/Vimeo, oficial/no oficial y `es`/`en`.

- [x] **Step 2: Escribir pruebas RED del mapping**

```ts
it("maps provider snake_case to MovieSummary and pagination contracts");
it("normalizes an empty release date to null");
it("normalizes an empty tagline and non-positive runtime to null");
it("selects the first crew member whose job is Director");
it("sorts cast by order and limits it to twenty");
it("limits keywords to fifty");
it("prefers official YouTube, then unofficial YouTube, then Vimeo");
it("prefers Spanish over English inside the same trailer tier");
it("returns trailer null when no compatible Trailer exists");
it("validates every public result with the existing Zod contracts");
```

- [x] **Step 3: Ejecutar RED**

Run: `pnpm test:run src/integrations/tmdb/__tests__/adapter.test.ts`

Expected: FAIL porque `adapter.ts` no existe.

- [x] **Step 4: Implementar mappings puros y API parcial**

```ts
export class TmdbAdapter {
  constructor(
    private readonly client: TmdbClient,
    private readonly cache?: MovieCachePort,
    private readonly language = TMDB_LANGUAGE,
  ) {}

  getGenres(): Promise<Genre[]>;
  searchMovies(input: SearchMoviesQuery): Promise<PaginatedMovies>;
  getMovieDetail(movieId: number): Promise<MovieDetail>;
  discoverMovies(input: TmdbDiscoverOptions): Promise<PaginatedMovies>;
  getSimilarMovies(input: {
    movieId: number;
    page?: number;
  }): Promise<PaginatedMovies>;
}
```

Definir los tipos auxiliares sin duplicar contratos:

```ts
const PaginatedMoviesSchema = paginatedResponseSchema(MovieSummarySchema);
type PaginatedMovies = z.infer<typeof PaginatedMoviesSchema>;

type MovieCachePort = Pick<
  MovieCacheRepository,
  "get" | "set" | "delete" | "isExpired"
>;
```

`getGenres`, `searchMovies` y `getMovieDetail` parsean sus salidas con `GenreSchema`, `SearchMoviesResponseSchema` y `MovieDetailSchema`.

Si un mapping no satisface un contrato público, el adapter convierte el `ZodError` en `TmdbError` con código `INVALID_RESPONSE`; nunca expone el payload crudo.

El selector de trailer ordena por la tupla:

```ts
const siteTier = (video: TmdbVideo) => {
  if (video.site === "YouTube") return video.official ? 0 : 1;
  if (video.site === "Vimeo") return video.official ? 2 : 3;
  return Number.POSITIVE_INFINITY;
};

const languageTier = (code: string | null) => {
  if (code === "es") return 0;
  if (code === "en") return 1;
  return 2;
};
```

Filtrar primero `type === "Trailer"` y sites compatibles; conservar orden original como desempate final.

- [x] **Step 5: Ejecutar GREEN**

Run: `pnpm test:run src/integrations/tmdb/__tests__/adapter.test.ts && pnpm typecheck`

Expected: mapping, límites y trailer PASS.

- [x] **Step 6: Commit**

```bash
git add src/fixtures/tmdb src/integrations/tmdb/adapter.ts src/integrations/tmdb/__tests__/adapter.test.ts
git commit -m "feat(foundation): adapt TMDB movie data"
```

### Task 12: Completar Discover, Similar y cache de detalle

**Files:**

- Modify: `src/integrations/tmdb/adapter.ts`
- Create: `src/integrations/tmdb/index.ts`
- Create: `src/integrations/tmdb/__tests__/cache.test.ts`
- Modify: `src/integrations/tmdb/__tests__/adapter.test.ts`
- Delete: `src/integrations/tmdb/.gitkeep`

- [x] **Step 1: Escribir pruebas RED de filtros**

Comprobar esta traducción exacta:

| Input                       | Query TMDB                              |
| --------------------------- | --------------------------------------- |
| `genreIds`                  | `with_genres` unido por coma            |
| `excludedGenreIds`          | `without_genres` unido por coma         |
| `keywordIds`                | `with_keywords` unido por coma          |
| `castIds`                   | `with_cast` unido por coma              |
| `crewIds`                   | `with_crew` unido por coma              |
| `originalLanguage`          | `with_original_language`                |
| `minRuntime` / `maxRuntime` | `with_runtime.gte` / `with_runtime.lte` |
| `minTmdbRating`             | `vote_average.gte`                      |
| `minTmdbVoteCount`          | `vote_count.gte`                        |

`TmdbDiscoverOptionsSchema` reutiliza el shape y el refinement del contrato compartido. No usar `.omit()` sobre `RecommendationFiltersSchema`, porque Zod 4.4.3 rechaza esa operación en schemas con refinements. `getSimilarMovies` valida `movieId` y page; ninguna operación calcula score ni ranking.

```ts
const { similarToMovieId: _similarToMovieId, ...tmdbDiscoverFilterShape } =
  RecommendationFiltersSchema.shape;

const TmdbDiscoverOptionsSchema = z
  .object({
    ...tmdbDiscoverFilterShape,
    page: PageQuerySchema.shape.page,
  })
  .strict()
  .transform(({ page, ...filters }) => ({
    ...RecommendationFiltersSchema.parse(filters),
    page,
  }));

type TmdbDiscoverOptions = z.infer<typeof TmdbDiscoverOptionsSchema>;
```

- [x] **Step 2: Escribir pruebas RED del cache**

```ts
it("returns a valid unexpired cached detail without calling TMDB");
it("refreshes an expired cache entry");
it("deletes and rebuilds an invalid cached payload");
it("returns a valid TMDB detail even when cache.set fails");
it("does not use movie_cache for genres, search, discover or similar");
```

- [x] **Step 3: Ejecutar RED**

Run: `pnpm test:run src/integrations/tmdb/__tests__/adapter.test.ts src/integrations/tmdb/__tests__/cache.test.ts`

Expected: FAIL en filtros y cache aún no implementados.

- [x] **Step 4: Implementar la orquestación del cache**

```ts
const cached = await this.cache?.get(movieId, this.language);

if (cached && !this.cache?.isExpired(cached)) {
  const parsed = TmdbMovieDetailResponseSchema.safeParse(cached.payload);
  if (parsed.success) return mapMovieDetail(parsed.data);
  await this.cache.delete(movieId, this.language).catch(() => false);
}

const providerMovie = await this.client.getMovieDetail(movieId);
await this.cache
  ?.set(movieId, this.language, providerMovie)
  .catch(() => undefined);
return mapMovieDetail(providerMovie);
```

El resultado final siempre se valida con `MovieDetailSchema.parse`. Un fallo de lectura del cache se propaga como infraestructura DB; sólo escritura y limpieza best-effort se desacoplan de una respuesta TMDB válida.

- [x] **Step 5: Crear el wiring público**

`index.ts` exporta `TmdbAdapter`, `TmdbError`, tipos públicos derivados y una factory lazy `getTmdb()` que conecta `getServerEnv()`, `getDatabase()`, `MovieCacheRepository`, `TmdbClient` y `TmdbAdapter`. No exporta schemas crudos ni el token.

- [x] **Step 6: Ejecutar GREEN**

Run: `pnpm test:run src/integrations/tmdb && pnpm typecheck && pnpm lint`

Expected: cliente, adapter, filtros y cache PASS.

- [x] **Step 7: Commit**

```bash
git add src/integrations/tmdb
git commit -m "feat(foundation): complete TMDB adapter and cache"
```

## Phase E — Evidencia real y documentación

### Task 13: Probar las cinco operaciones TMDB y los repositorios contra servicios reales

**Files:**

- Create: `tests/integration/tmdb.integration.test.ts`
- Modify: `tests/integration/repositories.integration.test.ts`
- Modify: `tests/integration/support/supabase.ts`

- [x] **Step 1: Completar cobertura de los cinco repositorios**

La suite debe verificar create/read/update/upsert/delete de cada repositorio, paginación 20, aislamiento entre dos usuarios, preservación de `watchedAt`, agregación de verdicts, TTL y cascade desde `auth.users`.

- [x] **Step 2: Escribir la prueba live de TMDB**

Usar IDs estables sólo para identificar requests, no para afirmar textos localizados:

```ts
const genres = await tmdb.getGenres();
expect(genres.some((genre) => genre.id === 18)).toBe(true);

const search = await tmdb.searchMovies({ query: "Interstellar", page: 1 });
expect(search.data.some((movie) => movie.id === 157336)).toBe(true);

const detail = await tmdb.getMovieDetail(157336);
expect(detail.id).toBe(157336);

const discovered = await tmdb.discoverMovies({ genreIds: [878], page: 1 });
expect(discovered.data.length).toBeGreaterThan(0);

const similar = await tmdb.getSimilarMovies({ movieId: 157336, page: 1 });
expect(similar.data.length).toBeGreaterThan(0);
```

Además, leer `movie_cache` después de Detail y confirmar que contiene una entrada validable para `(157336, "es-AR")`; eliminarla en `finally`.

- [x] **Step 3: Ejecutar toda la integración**

Run: `pnpm db:migrate && pnpm db:check && pnpm test:integration`

Expected: schema, cinco repositorios, Auth y cinco operaciones TMDB PASS. Todos los usuarios y filas temporales quedan eliminados incluso ante fallo.

- [x] **Step 4: Revisar que no se filtraron secretos**

Run: `git diff --check && git status --short && rg -n "(sb_secret_|service_role|eyJ[A-Za-z0-9_-]{20,}|postgres(?:ql)?://[^[:space:]]+:[^[:space:]@]+@)" --glob '!pnpm-lock.yaml' --glob '!.env*' .`

Expected: el scan no encuentra credenciales; cualquier coincidencia debe ser un nombre documental o fixture no sensible y revisarse manualmente.

- [x] **Step 5: Commit**

```bash
git add tests/integration
git commit -m "test(foundation): cover live backend integrations"
```

### Task 14: Documentar operación y ejecutar el gate completo

**Files:**

- Create: `docs/foundation-backend.md`
- Modify: `README.md`
- Modify: `openspec/changes/implement-foundation-backend/tasks.md`

- [x] **Step 1: Documentar setup sin valores reales**

`docs/foundation-backend.md` debe explicar:

- Origen de cada variable en Supabase/TMDB.
- Runtime pooler con `prepare: false` y URL separada de migración.
- Email confirmation desactivada sólo en desarrollo; SMTP/confirmación requeridos en producción.
- Data API desactivada, RLS habilitada sin policies y autorización explícita en services/repositories.
- `pnpm db:generate`, `db:migrate`, `db:check` y recuperación ante errores.
- `.env.integration.local`, uso exclusivo de la secret para cleanup y prohibición de CI sobre datos valiosos.
- Los seis códigos TMDB y cómo diagnosticar timeout, rate limit y credenciales inválidas.
- Que la UI futura debe incluir logo TMDB aprobado y el aviso de atribución exigido en About/Credits.

- [x] **Step 2: Actualizar README con comandos reales**

Agregar enlaces a la guía y estos comandos sin alterar la presentación del producto:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:check
pnpm test:integration
```

- [x] **Step 3: Marcar checkboxes sólo con evidencia**

Actualizar este archivo a `[x]` únicamente después de que el comando asociado haya finalizado con exit 0. Las tareas live permanecen `[ ]` si no existen credenciales reales; no sustituirlas con mocks ni declarar la Foundation terminada.

- [x] **Step 4: Ejecutar el gate local completo**

Run: `pnpm lint && pnpm typecheck && pnpm test:run && pnpm build`

Expected: todos exit 0; informar número real de archivos/tests.

- [x] **Step 5: Ejecutar el gate externo completo**

Run: `pnpm db:migrate && pnpm db:check && pnpm test:integration`

Expected: todos exit 0 contra Supabase/PostgreSQL y TMDB reales. Si falta configuración, reportar bloqueo de integración sin degradar la suite a skip.

- [x] **Step 6: Revisar diff y alcance**

Run: `git diff --check && git status --short && git diff --stat origin/develop...HEAD`

Confirmar manualmente:

- No hay UI, endpoints, recomendador, chat ni entidades futuras.
- No hay `userId` aceptado desde request; sólo métodos internos scoped.
- No se llama TMDB fuera de `src/integrations/tmdb/`.
- No hay secretos, URLs completas de imágenes TMDB ni tipos proveedor expuestos.
- Los archivos de texto nuevos son UTF-8 y no contienen mojibake.

- [x] **Step 7: Commit documental final**

```bash
git add README.md docs/foundation-backend.md openspec/changes/implement-foundation-backend/tasks.md
git commit -m "docs(foundation): document backend operations"
```

## 2. Matriz de aceptación

| Requisito aprobado           | Evidencia mínima                                                  |
| ---------------------------- | ----------------------------------------------------------------- |
| Environment seguro           | Unit tests del parser; scan sin secretos                          |
| Dos conexiones separadas     | `drizzle.config.ts` usa migration URL; runtime usa `DATABASE_URL` |
| Cinco tablas e invariantes   | Migraciones + introspección real + inserts inválidos rechazados   |
| Auth server-side             | Tests unitarios + signup/login/current user live                  |
| Autorización por propietario | Tests con dos usuarios y filtros `userId`                         |
| Cinco repositorios           | Suite de integración CRUD/agregación/TTL                          |
| Cinco operaciones TMDB       | Unit tests HTTP/adapter + suite live                              |
| Cache descartable            | Tests válido/vencido/corrupto/write-failure + fila live           |
| Contratos Zod respetados     | Toda salida adapter pasa schemas existentes                       |
| Reproducibilidad             | `db:migrate` idempotente y `db:check` exit 0                      |
| Calidad                      | lint, typecheck, unit tests, build e integration exit 0           |

## 3. Punto de handoff

La implementación termina cuando otro módulo puede ejecutar:

```ts
const user = await authService.requireCurrentUser();
const movie = await tmdb.getMovieDetail(157336);
await interactionRepository.upsertReaction(user.id, movie.id, "LIKE");
```

sin conocer cookies de Supabase, SQL, payloads TMDB ni política de cache. La rama no se fusiona ni se publica sin autorización explícita.
