# Fase 1 — Contratos Zod finales del MVP

**Proyecto:** App de descubrimiento y recomendación de películas  
**Stack objetivo:** Next.js + TypeScript + Zod + Supabase + TMDB  
**Estado:** Contratos de dominio y API listos para implementación  
**Fecha:** 17 de agosto de 2026

---

# 1. Objetivo

Este documento define los contratos finales que compartirán frontend y backend durante el MVP.

Los contratos se expresan con **Zod real** y deben funcionar como **Single Source of Truth** para:

- validación de requests;
- validación de responses;
- inferencia de tipos TypeScript;
- mocks y fixtures;
- integración frontend/backend;
- límites de dominio;
- documentación de endpoints.

Los tipos TypeScript **no deben duplicarse manualmente**. Deben derivarse siempre desde Zod con:

```ts
z.infer<typeof Schema>
```

---

# 2. Decisiones de producto cerradas

## 2.1 Contenido soportado

El MVP trabaja exclusivamente con:

```text
MOVIES
```

No se incluyen series.

---

## 2.2 Identidad de película

La aplicación utiliza directamente:

```text
TMDB movie.id
```

como identificador externo de una película.

No se crea un UUID local adicional para el catálogo.

```text
movieId: number
```

representa siempre un ID de película de TMDB.

---

## 2.3 Configuración TMDB

La configuración es responsabilidad exclusiva del servidor:

```ts
const TMDB_CONTEXT = {
  language: "es-AR",
  region: "AR",
  includeAdult: false,
} as const
```

El frontend **no envía** estos valores.

---

## 2.4 Onboarding

Requisitos mínimos:

```text
2 géneros
3 películas que le gusten al usuario
```

Las películas seleccionadas durante onboarding generan:

```text
reaction = LIKE
watchedAt = now()
```

porque el onboarding pregunta por películas que el usuario ya conoce y le gustan.

---

## 2.5 Reacción del usuario

La preferencia persistida puede ser:

```text
LIKE
DISLIKE
```

El gesto de swipe es una decisión de UI.

El dato de dominio es:

```text
MovieReaction
```

---

## 2.6 watchedAt

`watchedAt` es independiente de que exista una reacción y, si existe, de que sea positiva o negativa.

Son estados válidos:

```text
LIKE + watchedAt
LIKE + watchedAt = null

DISLIKE + watchedAt
DISLIKE + watchedAt = null

reaction = null + watchedAt
```

Esto permite representar:

> "La vi y no me gustó."

Cambiar:

```text
LIKE → DISLIKE
```

o:

```text
DISLIKE → LIKE
```

**preserva `watchedAt`.**

Si se elimina completamente la reacción, `watchedAt` se preserva. La película vuelve a ser neutral respecto del gusto y puede volver a aparecer en Discover aunque siga marcada como vista.

---

## 2.7 Lista de Me gusta

No existe Watchlist.

La lista personal del usuario se obtiene directamente de:

```text
reaction = LIKE
```

La lista puede filtrarse por:

```text
todas
vistas
no vistas
```

---

## 2.8 Película evaluada

Una película se considera evaluada cuando existe una reacción:

```text
evaluated = reaction === LIKE || reaction === DISLIKE
```

Por lo tanto:

```text
LIKE
→ sale de Discover

DISLIKE
→ sale de Discover
```

`watchedAt` no modifica esta regla.

---

## 2.9 Reviews

No existe rating numérico propio.

Una Review contiene:

```text
RECOMMENDED
NOT_WORTH_IT

title
description
```

Restricciones:

```text
title
min: 3
max: 30

description
min: 10
max: 400
```

Una Review no altera automáticamente:

```text
reaction
watchedAt
Taste Profile
```

en el MVP.

---

## 2.10 Trailer

El detalle incluye un trailer cuando TMDB provee uno.

TMDB permite obtener videos de películas y el detalle soporta `append_to_response`, por lo que la integración puede solicitar conceptualmente:

```text
movie details
+
credits
+
keywords
+
videos
```

en una única consulta al detalle.

Nuestro contrato expone solamente **un trailer seleccionado**, no todos los videos del proveedor.

---

## 2.11 Paginación

Todas las listas paginadas utilizan:

```text
PAGE_SIZE = 20
```

El cliente puede elegir:

```text
page
```

pero no puede modificar `pageSize`.

Se utiliza paginación por página para:

- búsqueda;
- lista de Me gusta;
- reviews.

Discover no utiliza paginación pública tradicional.

---

## 2.12 Chat

El chat no se persiste durante el MVP.

El cliente envía el contexto conversacional necesario.

El backend:

```text
interpreta intención
→ consulta RecommendationService
→ obtiene películas reales
→ genera explicación
→ responde por streaming
```

---

# 3. Estructura de contratos

```text
src/
  contracts/
    common.ts
    errors.ts
    movies.ts
    interactions.ts
    onboarding.ts
    preferences.ts
    search.ts
    discover.ts
    likes.ts
    reviews.ts
    movie-detail.ts
    chat.ts
    index.ts
```

---

# 4. `common.ts`

```ts
import { z } from "zod"

export const PAGE_SIZE = 20 as const

export const TmdbMovieIdSchema = z
  .number()
  .int()
  .positive()

export const TmdbGenreIdSchema = z
  .number()
  .int()
  .positive()

export const TmdbPersonIdSchema = z
  .number()
  .int()
  .positive()

export const TmdbKeywordIdSchema = z
  .number()
  .int()
  .positive()

export const UuidSchema = z
  .string()
  .uuid()

export const DateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)

export const IsoDateTimeSchema = z
  .string()
  .datetime({ offset: true })

export const MovieRouteParamsSchema = z.object({
  movieId: z.coerce
    .number()
    .int()
    .positive(),
})

export const PageQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),
})

export const PaginationMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.literal(PAGE_SIZE),
  totalPages: z.number().int().min(0),
  totalResults: z.number().int().min(0),
  hasNextPage: z.boolean(),
})

export const apiDataResponseSchema = <
  T extends z.ZodTypeAny,
>(dataSchema: T) =>
  z.object({
    data: dataSchema,
  })

export const paginatedResponseSchema = <
  T extends z.ZodTypeAny,
>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    meta: PaginationMetaSchema,
  })

export type TmdbMovieId = z.infer<
  typeof TmdbMovieIdSchema
>

export type TmdbGenreId = z.infer<
  typeof TmdbGenreIdSchema
>

export type TmdbPersonId = z.infer<
  typeof TmdbPersonIdSchema
>

export type TmdbKeywordId = z.infer<
  typeof TmdbKeywordIdSchema
>

export type PaginationMeta = z.infer<
  typeof PaginationMetaSchema
>
```

---

# 5. Consideración sobre fechas

TMDB puede entregar fechas faltantes o valores vacíos.

El `TmdbAdapter` debe normalizar:

```text
""
```

a:

```text
null
```

antes de validar contra nuestros contratos.

Nuestra aplicación no propaga el formato inconsistente del proveedor.

---

# 6. `errors.ts`

```ts
import { z } from "zod"

export const ApiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",

  "ONBOARDING_REQUIRED",

  "MOVIE_NOT_FOUND",
  "REACTION_NOT_FOUND",
  "REACTION_REQUIRED",

  "REVIEW_NOT_FOUND",

  "TMDB_UNAVAILABLE",

  "INTERNAL_ERROR",
])

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
})

export type ApiErrorCode = z.infer<
  typeof ApiErrorCodeSchema
>

export type ApiError = z.infer<
  typeof ApiErrorSchema
>
```

---

# 7. Mapeo HTTP de errores

| HTTP | Código |
|---|---|
| `400` | `VALIDATION_ERROR` |
| `401` | `UNAUTHORIZED` |
| `403` | `FORBIDDEN` |
| `404` | `NOT_FOUND`, `MOVIE_NOT_FOUND`, `REACTION_NOT_FOUND`, `REVIEW_NOT_FOUND` |
| `409` | `CONFLICT`, `REACTION_REQUIRED`, `ONBOARDING_REQUIRED` |
| `429` | `RATE_LIMITED` |
| `502/503/504` | `TMDB_UNAVAILABLE` |
| `500` | `INTERNAL_ERROR` |

La UI debe reaccionar principalmente a:

```text
error.code
```

y no al texto de `message`.

---

# 8. Autenticación

El MVP utiliza autenticación propia de la aplicación, previsiblemente mediante Supabase Auth.

Los endpoints protegidos nunca aceptan:

```ts
userId
```

desde el frontend.

Incorrecto:

```json
{
  "userId": "uuid",
  "movieId": 157336
}
```

Correcto:

```json
{
  "reaction": "LIKE"
}
```

El backend obtiene el usuario desde la sesión autenticada.

---

# 9. `movies.ts`

```ts
import { z } from "zod"

import {
  DateOnlySchema,
  TmdbGenreIdSchema,
  TmdbKeywordIdSchema,
  TmdbMovieIdSchema,
  TmdbPersonIdSchema,
} from "./common"

export const GenreSchema = z.object({
  id: TmdbGenreIdSchema,
  name: z.string().min(1),
})

export const PersonSummarySchema = z.object({
  id: TmdbPersonIdSchema,
  name: z.string().min(1),
  profilePath: z.string().nullable(),
})

export const CastMemberSchema = z.object({
  id: TmdbPersonIdSchema,
  name: z.string().min(1),
  character: z.string(),
  profilePath: z.string().nullable(),
  order: z.number().int().min(0),
})

export const KeywordSchema = z.object({
  id: TmdbKeywordIdSchema,
  name: z.string().min(1),
})

export const TrailerSchema = z.object({
  name: z.string().min(1),
  site: z.string().min(1),
  key: z.string().min(1),
  official: z.boolean(),
})

export const MovieSummarySchema = z.object({
  id: TmdbMovieIdSchema,

  title: z.string().min(1),
  originalTitle: z.string().min(1),
  overview: z.string(),

  posterPath: z.string().nullable(),
  backdropPath: z.string().nullable(),

  genreIds: z.array(TmdbGenreIdSchema),

  releaseDate: DateOnlySchema.nullable(),
  originalLanguage: z.string().min(2),

  tmdbRating: z.number().min(0).max(10),
  tmdbVoteCount: z.number().int().min(0),
})

export const MovieDetailSchema = z.object({
  id: TmdbMovieIdSchema,

  title: z.string().min(1),
  originalTitle: z.string().min(1),
  overview: z.string(),
  tagline: z.string().nullable(),

  posterPath: z.string().nullable(),
  backdropPath: z.string().nullable(),

  releaseDate: DateOnlySchema.nullable(),
  runtime: z.number().int().positive().nullable(),
  originalLanguage: z.string().min(2),

  genres: z.array(GenreSchema),

  tmdbRating: z.number().min(0).max(10),
  tmdbVoteCount: z.number().int().min(0),

  director: PersonSummarySchema.nullable(),

  cast: z
    .array(CastMemberSchema)
    .max(20),

  keywords: z
    .array(KeywordSchema)
    .max(50),

  trailer: TrailerSchema.nullable(),
})

export type Genre = z.infer<
  typeof GenreSchema
>

export type PersonSummary = z.infer<
  typeof PersonSummarySchema
>

export type CastMember = z.infer<
  typeof CastMemberSchema
>

export type Keyword = z.infer<
  typeof KeywordSchema
>

export type Trailer = z.infer<
  typeof TrailerSchema
>

export type MovieSummary = z.infer<
  typeof MovieSummarySchema
>

export type MovieDetail = z.infer<
  typeof MovieDetailSchema
>
```

---

# 10. Normalización TMDB → MovieSummary

TMDB utiliza normalmente campos como:

```text
original_title
poster_path
backdrop_path
genre_ids
release_date
original_language
vote_average
vote_count
```

Nuestro Adapter los normaliza a:

```text
originalTitle
posterPath
backdropPath
genreIds
releaseDate
originalLanguage
tmdbRating
tmdbVoteCount
```

La transformación es deliberadamente superficial.

No estamos creando otro modelo cinematográfico.

Estamos creando una frontera estable entre proveedor y producto.

---

# 11. Normalización de cast

El detalle no necesita retornar cientos de créditos.

Para el MVP:

```text
cast máximo: 20
```

El Adapter debe:

```text
ordenar por order
→ tomar los primeros 20
```

El Recommendation Engine puede utilizar más información internamente si más adelante lo necesita.

El límite del DTO existe para proteger el payload enviado a UI.

---

# 12. Selección del trailer

TMDB puede devolver múltiples videos.

El Adapter debe seleccionar como máximo uno.

Prioridad sugerida:

```text
1. type = Trailer
2. official = true
3. site soportado por la UI
4. idioma solicitado
5. trailer más apropiado/reciente
```

Si no existe un video usable:

```ts
trailer: null
```

No se debe generar un error de Movie Detail por ausencia de trailer.

---

# 13. Genres endpoint

## `GET /api/genres`

Obtiene la lista oficial de géneros de películas de TMDB, normalizada a nuestro contrato.

### Response

```ts
import { z } from "zod"

import {
  apiDataResponseSchema,
} from "./common"

import {
  GenreSchema,
} from "./movies"

export const GenresResponseSchema =
  apiDataResponseSchema(
    z.array(GenreSchema),
  )
```

Ejemplo:

```json
{
  "data": [
    {
      "id": 28,
      "name": "Acción"
    },
    {
      "id": 18,
      "name": "Drama"
    }
  ]
}
```

---

# 14. `interactions.ts`

```ts
import { z } from "zod"

import {
  IsoDateTimeSchema,
  TmdbMovieIdSchema,
  apiDataResponseSchema,
} from "./common"

export const MovieReactionSchema = z.enum([
  "LIKE",
  "DISLIKE",
])

export const ViewerMovieStateSchema = z.object({
  reaction: MovieReactionSchema.nullable(),
  watchedAt: IsoDateTimeSchema.nullable(),
})

export const SetMovieReactionRequestSchema =
  z.object({
    reaction: MovieReactionSchema.nullable(),
  })

export const MovieInteractionStateSchema =
  z.object({
    movieId: TmdbMovieIdSchema,
    reaction: MovieReactionSchema,
    watchedAt: IsoDateTimeSchema.nullable(),
  })

export const SetMovieReactionResponseSchema =
  apiDataResponseSchema(
    MovieInteractionStateSchema,
  )

export const SetWatchedRequestSchema = z.object({
  watched: z.boolean(),
})

export const SetWatchedResponseSchema =
  apiDataResponseSchema(
    MovieInteractionStateSchema,
  )

export const DeleteMovieReactionResponseSchema =
  apiDataResponseSchema(
    z.object({
      movieId: TmdbMovieIdSchema,
      reaction: z.null(),
      watchedAt: IsoDateTimeSchema.nullable(),
    }),
  )

export type MovieReaction = z.infer<
  typeof MovieReactionSchema
>

export type ViewerMovieState = z.infer<
  typeof ViewerMovieStateSchema
>

export type MovieInteractionState = z.infer<
  typeof MovieInteractionStateSchema
>
```

---

# 15. Contratos de reacción

## Crear o cambiar reacción

```http
PUT /api/me/movies/:movieId/reaction
```

### Request

```json
{
  "reaction": "LIKE"
}
```

o:

```json
{
  "reaction": "DISLIKE"
}
```

### Semántica

El endpoint realiza `upsert`.

Ejemplo:

```text
sin estado
→ PUT LIKE
→ LIKE + watchedAt null
```

Cambio de opinión:

```text
LIKE + watchedAt 2026-08-17...
→ PUT DISLIKE
→ DISLIKE + watchedAt 2026-08-17...
```

`watchedAt` se preserva.

---

# 16. Eliminar reacción

```http
DELETE /api/me/movies/:movieId/reaction
```

Elimina el estado de reacción y preserva el estado de vista.

Resultado:

```text
reaction = null
watchedAt = valor anterior
```

La película:

```text
deja de estar evaluada
```

y puede volver a aparecer en Discover.

---

# 17. Marcar como vista / no vista

```http
PUT /api/me/movies/:movieId/watched
```

### Request

Marcar vista:

```json
{
  "watched": true
}
```

Backend:

```text
watchedAt = now()
```

Marcar no vista:

```json
{
  "watched": false
}
```

Backend:

```text
watchedAt = null
```

### Regla

No requiere una reacción previa. Si no existe una interacción, marcar vista crea una fila con `reaction = null`; marcar no vista elimina esa fila vacía.

---

# 18. `onboarding.ts`

```ts
import { z } from "zod"

import {
  IsoDateTimeSchema,
  TmdbGenreIdSchema,
  TmdbMovieIdSchema,
  apiDataResponseSchema,
} from "./common"

const UniquePreferredGenreIdsSchema = z
  .array(TmdbGenreIdSchema)
  .min(
    2,
    "Select at least 2 preferred genres",
  )
  .refine(
    (ids) =>
      new Set(ids).size === ids.length,
    {
      message:
        "preferredGenreIds cannot contain duplicates",
    },
  )

const UniqueLikedMovieIdsSchema = z
  .array(TmdbMovieIdSchema)
  .min(
    3,
    "Select at least 3 liked movies",
  )
  .refine(
    (ids) =>
      new Set(ids).size === ids.length,
    {
      message:
        "likedMovieIds cannot contain duplicates",
    },
  )

export const CompleteOnboardingRequestSchema =
  z.object({
    preferredGenreIds:
      UniquePreferredGenreIdsSchema,

    likedMovieIds:
      UniqueLikedMovieIdsSchema,
  })

export const CompleteOnboardingResponseSchema =
  apiDataResponseSchema(
    z.object({
      completed: z.literal(true),
      completedAt: IsoDateTimeSchema,
    }),
  )

export type CompleteOnboardingRequest =
  z.infer<
    typeof CompleteOnboardingRequestSchema
  >
```

---

# 19. Onboarding endpoint

```http
POST /api/onboarding
```

### Request

```json
{
  "preferredGenreIds": [878, 18],
  "likedMovieIds": [
    157336,
    438631,
    329865
  ]
}
```

### Side effects

Por cada `likedMovieId`:

```text
reaction = LIKE
watchedAt = now()
```

La operación debe ejecutarse transaccionalmente para los datos propios de nuestra DB.

---

# 20. `preferences.ts`

Después del onboarding, las películas que le gustan al usuario viven en sus reacciones `LIKE`.

Por eso `UserPreferences` solamente necesita conservar preferencias explícitas que no estén representadas en otra entidad.

```ts
import { z } from "zod"

import {
  IsoDateTimeSchema,
  TmdbGenreIdSchema,
  apiDataResponseSchema,
} from "./common"

export const PreferredGenreIdsSchema = z
  .array(TmdbGenreIdSchema)
  .min(2)
  .refine(
    (ids) =>
      new Set(ids).size === ids.length,
    {
      message:
        "preferredGenreIds cannot contain duplicates",
    },
  )

export const UserPreferencesSchema =
  z.object({
    preferredGenreIds:
      PreferredGenreIdsSchema,

    onboardingCompleted:
      z.boolean(),

    onboardingCompletedAt:
      IsoDateTimeSchema.nullable(),
  })

export const GetPreferencesResponseSchema =
  apiDataResponseSchema(
    UserPreferencesSchema,
  )

export const UpdatePreferencesRequestSchema =
  z.object({
    preferredGenreIds:
      PreferredGenreIdsSchema,
  })

export const UpdatePreferencesResponseSchema =
  apiDataResponseSchema(
    UserPreferencesSchema,
  )

export type UserPreferences = z.infer<
  typeof UserPreferencesSchema
>
```

---

# 21. Preferences endpoints

## Obtener

```http
GET /api/me/preferences
```

## Actualizar

```http
PUT /api/me/preferences
```

### Request

```json
{
  "preferredGenreIds": [878, 53]
}
```

Cambiar géneros no modifica Likes o Dislikes existentes.

---

# 22. `search.ts`

Nuestro contrato conserva los conceptos principales de TMDB Search:

```text
query
page
```

El servidor agrega automáticamente:

```text
language
region
includeAdult
```

```ts
import { z } from "zod"

import {
  PageQuerySchema,
  paginatedResponseSchema,
} from "./common"

import {
  MovieSummarySchema,
} from "./movies"

export const SearchMoviesQuerySchema =
  PageQuerySchema.extend({
    query: z
      .string()
      .trim()
      .min(1)
      .max(100),
  })

export const SearchMoviesResponseSchema =
  paginatedResponseSchema(
    MovieSummarySchema,
  )

export type SearchMoviesQuery = z.infer<
  typeof SearchMoviesQuerySchema
>
```

---

# 23. Search endpoint

```http
GET /api/movies/search?query=interstellar&page=1
```

### Response

```json
{
  "data": [
    {
      "id": 157336,
      "title": "Interstellar",
      "originalTitle": "Interstellar",
      "overview": "...",
      "posterPath": "/...",
      "backdropPath": "/...",
      "genreIds": [12, 18, 878],
      "releaseDate": "2014-11-05",
      "originalLanguage": "en",
      "tmdbRating": 8.5,
      "tmdbVoteCount": 38000
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalPages": 3,
    "totalResults": 42,
    "hasNextPage": true
  }
}
```

---

# 24. `discover.ts`

Discover no expone directamente la API de TMDB.

El frontend solicita:

```http
GET /api/discover
```

El servidor decide cómo generar y rankear candidatos.

```ts
import { z } from "zod"

import {
  TmdbGenreIdSchema,
  TmdbKeywordIdSchema,
  TmdbMovieIdSchema,
  TmdbPersonIdSchema,
  apiDataResponseSchema,
} from "./common"

import {
  MovieSummarySchema,
} from "./movies"

export const DiscoverResponseSchema =
  apiDataResponseSchema(
    z.object({
      movies: z
        .array(MovieSummarySchema)
        .max(20),

      batchSize: z.literal(20),

      returned: z
        .number()
        .int()
        .min(0)
        .max(20),
    }),
  )

export const RecommendationFiltersSchema =
  z.object({
    genreIds: z
      .array(TmdbGenreIdSchema)
      .optional(),

    excludedGenreIds: z
      .array(TmdbGenreIdSchema)
      .optional(),

    keywordIds: z
      .array(TmdbKeywordIdSchema)
      .optional(),

    castIds: z
      .array(TmdbPersonIdSchema)
      .optional(),

    crewIds: z
      .array(TmdbPersonIdSchema)
      .optional(),

    originalLanguage: z
      .string()
      .min(2)
      .optional(),

    minRuntime: z
      .number()
      .int()
      .positive()
      .optional(),

    maxRuntime: z
      .number()
      .int()
      .positive()
      .optional(),

    minTmdbRating: z
      .number()
      .min(0)
      .max(10)
      .optional(),

    minTmdbVoteCount: z
      .number()
      .int()
      .min(0)
      .optional(),

    similarToMovieId:
      TmdbMovieIdSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.minRuntime !== undefined &&
      value.maxRuntime !== undefined &&
      value.minRuntime > value.maxRuntime
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxRuntime"],
        message:
          "maxRuntime must be greater than or equal to minRuntime",
      })
    }
  })

export const RecommendationRequestSchema =
  z.object({
    filters:
      RecommendationFiltersSchema
        .default({}),

    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(20),

    excludeMovieIds: z
      .array(TmdbMovieIdSchema)
      .default([]),
  })

export type RecommendationFilters =
  z.infer<
    typeof RecommendationFiltersSchema
  >

export type RecommendationRequest =
  z.infer<
    typeof RecommendationRequestSchema
  >
```

---

# 25. Public Discover vs RecommendationService

`RecommendationRequestSchema` es un **contrato interno**, no un body enviado por el frontend para Discover.

Flujo público:

```text
GET /api/discover
        │
        ▼
authenticated user
        │
        ▼
TasteProfileService
        │
        ▼
RecommendationService
        │
        ▼
TMDB candidate generation
        │
        ▼
local ranking
        │
        ▼
remove evaluated movies
        │
        ▼
up to 20 movies
```

El frontend no puede alterar pesos ni criterios internos del recomendador.

---

# 26. Discover no usa `page`

La lista cambia después de cada interacción.

Ejemplo:

```text
batch de 20
→ usuario reacciona
→ esas películas quedan evaluadas
→ próximo batch
```

Por eso un:

```text
page=2
```

no posee una semántica estable.

Discover devuelve siempre:

```text
hasta 20 candidatos actuales
```

---

# 27. `likes.ts`

La Lista de Me gusta es una proyección de las interacciones:

```text
reaction = LIKE
```

```ts
import { z } from "zod"

import {
  IsoDateTimeSchema,
  PageQuerySchema,
  paginatedResponseSchema,
} from "./common"

import {
  MovieSummarySchema,
} from "./movies"

export const LikesWatchedFilterSchema =
  z.enum([
    "all",
    "watched",
    "unwatched",
  ])

export const LikesQuerySchema =
  PageQuerySchema.extend({
    watched:
      LikesWatchedFilterSchema
        .default("all"),
  })

export const LikedMovieItemSchema =
  z.object({
    movie: MovieSummarySchema,

    likedAt: IsoDateTimeSchema,

    watchedAt:
      IsoDateTimeSchema.nullable(),
  })

export const LikesResponseSchema =
  paginatedResponseSchema(
    LikedMovieItemSchema,
  )

export type LikesQuery = z.infer<
  typeof LikesQuerySchema
>

export type LikedMovieItem = z.infer<
  typeof LikedMovieItemSchema
>
```

---

# 28. Likes endpoint

```http
GET /api/me/likes?page=1&watched=all
```

Filtros:

```text
all
watched
unwatched
```

Ejemplos:

```http
GET /api/me/likes?page=1&watched=watched
```

```http
GET /api/me/likes?page=1&watched=unwatched
```

Cada página contiene como máximo:

```text
20 películas
```

---

# 29. Eliminar desde Lista de Me gusta

No existe un endpoint especial:

```text
DELETE /likes/:movieId
```

Se reutiliza:

```http
DELETE /api/me/movies/:movieId/reaction
```

Esto evita tener dos operaciones diferentes capaces de modificar el mismo estado.

---

# 30. `reviews.ts`

```ts
import { z } from "zod"

import {
  IsoDateTimeSchema,
  PageQuerySchema,
  TmdbMovieIdSchema,
  UuidSchema,
  apiDataResponseSchema,
  paginatedResponseSchema,
} from "./common"

export const ReviewVerdictSchema = z.enum([
  "RECOMMENDED",
  "NOT_WORTH_IT",
])

export const ReviewTitleSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)

export const ReviewDescriptionSchema = z
  .string()
  .trim()
  .min(10)
  .max(400)

export const ReviewAuthorSchema =
  z.object({
    displayName: z
      .string()
      .min(1)
      .max(80),

    avatarUrl: z
      .string()
      .url()
      .nullable(),
  })

export const ReviewSchema = z.object({
  id: UuidSchema,

  movieId: TmdbMovieIdSchema,

  author: ReviewAuthorSchema,

  verdict: ReviewVerdictSchema,

  title: ReviewTitleSchema,

  description: ReviewDescriptionSchema,

  isMine: z.boolean(),

  createdAt: IsoDateTimeSchema,

  updatedAt: IsoDateTimeSchema,
})

export const ReviewSummarySchema =
  z.object({
    recommended: z
      .number()
      .int()
      .min(0),

    notWorthIt: z
      .number()
      .int()
      .min(0),

    total: z
      .number()
      .int()
      .min(0),

    recommendationRate: z
      .number()
      .min(0)
      .max(100)
      .nullable(),
  })
  .superRefine((value, ctx) => {
    if (
      value.total !==
      value.recommended +
        value.notWorthIt
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["total"],
        message:
          "total must equal recommended + notWorthIt",
      })
    }

    if (
      value.total === 0 &&
      value.recommendationRate !== null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recommendationRate"],
        message:
          "recommendationRate must be null when total is 0",
      })
    }
  })

export const UpsertReviewRequestSchema =
  z.object({
    verdict: ReviewVerdictSchema,
    title: ReviewTitleSchema,
    description:
      ReviewDescriptionSchema,
  })

export const UpsertReviewResponseSchema =
  apiDataResponseSchema(
    ReviewSchema,
  )

export const ReviewsQuerySchema =
  PageQuerySchema

export const ReviewsResponseSchema =
  paginatedResponseSchema(
    ReviewSchema,
  )

export const DeleteReviewResponseSchema =
  apiDataResponseSchema(
    z.object({
      movieId: TmdbMovieIdSchema,
      deleted: z.literal(true),
    }),
  )

export type ReviewVerdict = z.infer<
  typeof ReviewVerdictSchema
>

export type Review = z.infer<
  typeof ReviewSchema
>

export type ReviewSummary = z.infer<
  typeof ReviewSummarySchema
>

export type UpsertReviewRequest = z.infer<
  typeof UpsertReviewRequestSchema
>
```

---

# 31. Review endpoints

## Listar

```http
GET /api/movies/:movieId/reviews?page=1
```

## Crear o actualizar review propia

```http
PUT /api/movies/:movieId/review
```

### Request

```json
{
  "verdict": "RECOMMENDED",
  "title": "Muy recomendable",
  "description": "Gran dirección y una historia que mantiene el interés hasta el final."
}
```

`PUT` realiza `upsert`.

## Eliminar review propia

```http
DELETE /api/movies/:movieId/review
```

---

# 32. Semántica Review vs Reaction

No se fuerza una equivalencia entre:

```text
LIKE
```

y:

```text
RECOMMENDED
```

ni entre:

```text
DISLIKE
```

y:

```text
NOT_WORTH_IT
```

Son conceptos distintos.

Ejemplos válidos:

```text
LIKE
+
NOT_WORTH_IT
```

o:

```text
DISLIKE
+
RECOMMENDED
```

Aunque sean menos frecuentes.

Esto evita introducir reglas implícitas difíciles de mantener.

---

# 33. `movie-detail.ts`

Movie Detail combina:

```text
TMDB metadata
+
viewer state
+
review summary
+
review propia
```

Las reviews públicas completas se obtienen desde el endpoint paginado de reviews.

```ts
import { z } from "zod"

import {
  apiDataResponseSchema,
} from "./common"

import {
  MovieDetailSchema,
} from "./movies"

import {
  ViewerMovieStateSchema,
} from "./interactions"

import {
  ReviewSchema,
  ReviewSummarySchema,
} from "./reviews"

export const MovieDetailPageDataSchema =
  z.object({
    movie: MovieDetailSchema,

    viewerState:
      ViewerMovieStateSchema,

    reviewSummary:
      ReviewSummarySchema,

    myReview:
      ReviewSchema.nullable(),
  })

export const MovieDetailResponseSchema =
  apiDataResponseSchema(
    MovieDetailPageDataSchema,
  )

export type MovieDetailPageData =
  z.infer<
    typeof MovieDetailPageDataSchema
  >
```

---

# 34. Movie Detail endpoint

```http
GET /api/movies/:movieId
```

Ejemplo conceptual:

```json
{
  "data": {
    "movie": {
      "id": 157336,
      "title": "Interstellar",
      "originalTitle": "Interstellar",
      "overview": "...",
      "tagline": "...",
      "posterPath": "/...",
      "backdropPath": "/...",
      "releaseDate": "2014-11-05",
      "runtime": 169,
      "originalLanguage": "en",
      "genres": [],
      "tmdbRating": 8.5,
      "tmdbVoteCount": 38000,
      "director": {
        "id": 525,
        "name": "Christopher Nolan",
        "profilePath": "/..."
      },
      "cast": [],
      "keywords": [],
      "trailer": {
        "name": "Official Trailer",
        "site": "YouTube",
        "key": "example",
        "official": true
      }
    },
    "viewerState": {
      "reaction": "LIKE",
      "watchedAt": "2026-08-17T16:00:00.000Z"
    },
    "reviewSummary": {
      "recommended": 84,
      "notWorthIt": 16,
      "total": 100,
      "recommendationRate": 84
    },
    "myReview": null
  }
}
```

---

# 35. Por qué las reviews públicas no vienen todas en Movie Detail

No queremos:

```text
GET movie detail
→ descargar cientos de reviews
```

Movie Detail contiene:

```text
reviewSummary
myReview
```

La sección pública obtiene:

```http
GET /api/movies/:movieId/reviews?page=1
```

Esto mantiene estable y liviano el detalle.

---

# 36. `chat.ts`

El chat no usa un JSON response tradicional completo porque su salida será streaming.

Sí validamos:

1. request del cliente;
2. payloads estructurados de recomendaciones.

```ts
import { z } from "zod"

import {
  MovieSummarySchema,
} from "./movies"

export const ChatRoleSchema = z.enum([
  "user",
  "assistant",
])

export const ChatMessageSchema =
  z.object({
    id: z
      .string()
      .min(1)
      .max(100)
      .optional(),

    role: ChatRoleSchema,

    content: z
      .string()
      .trim()
      .min(1)
      .max(4000),
  })

export const ChatRequestSchema = z
  .object({
    messages: z
      .array(ChatMessageSchema)
      .min(1)
      .max(20),
  })
  .superRefine((value, ctx) => {
    const lastMessage =
      value.messages[
        value.messages.length - 1
      ]

    if (
      lastMessage?.role !== "user"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["messages"],
        message:
          "The last chat message must be from the user",
      })
    }
  })

export const ChatMovieRecommendationsPayloadSchema =
  z.object({
    movies: z
      .array(MovieSummarySchema)
      .min(1)
      .max(10),
  })

export type ChatMessage = z.infer<
  typeof ChatMessageSchema
>

export type ChatRequest = z.infer<
  typeof ChatRequestSchema
>

export type ChatMovieRecommendationsPayload =
  z.infer<
    typeof ChatMovieRecommendationsPayloadSchema
  >
```

---

# 37. Chat endpoint

```http
POST /api/chat
```

### Request

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Quiero una película parecida a Dune pero de menos de dos horas."
    }
  ]
}
```

El servidor incorpora internamente:

```text
authenticated user
Taste Profile
preferences
likes
dislikes
RecommendationService
```

El frontend no envía esta información.

---

# 38. Transporte de Chat

La respuesta puede implementarse mediante:

```text
Vercel AI SDK streaming
```

o transporte SSE equivalente.

No se crea:

```text
Conversation
ChatMessage
```

en DB para el MVP.

Los elementos de película enviados dentro del stream deben respetar:

```text
ChatMovieRecommendationsPayloadSchema
```

Esto permite renderizar Movie Cards reales y evita que el LLM invente contratos propios.

---

# 39. Recommendation Engine — contrato interno

El Recommendation Engine debe exponer conceptualmente:

```ts
type RecommendationService = {
  recommend(
    input: RecommendationRequest,
  ): Promise<MovieSummary[]>
}
```

El servicio recibe el usuario desde contexto de aplicación, no desde requests públicos.

Responsabilidades:

```text
build Taste Profile
→ generate candidates
→ exclude evaluated
→ rank
→ return movies
```

---

# 40. Taste Profile V1

Se calcula utilizando:

```text
preferred genres
+
LIKE
+
DISLIKE
+
TMDB metadata de esas películas
```

Puede obtener afinidades sobre:

```text
genres
keywords
cast
crew/director
```

No utiliza en V1:

```text
Review verdicts
watchedAt
collaborative filtering
embeddings
pgvector
```

`watchedAt` es una característica personal de organización, no una señal de gusto.

---

# 41. TMDB Adapter — interfaz recomendada

```ts
type TmdbContext = {
  language: "es-AR"
  region: "AR"
  includeAdult: false
}

type TmdbMovieProvider = {
  getGenres(): Promise<Genre[]>

  searchMovies(input: {
    query: string
    page: number
  }): Promise<{
    results: MovieSummary[]
    page: number
    totalPages: number
    totalResults: number
  }>

  getMovieDetail(
    movieId: number,
  ): Promise<MovieDetail>

  discoverMovies(
    input: RecommendationFilters & {
      page: number
    },
  ): Promise<{
    results: MovieSummary[]
    page: number
    totalPages: number
    totalResults: number
  }>

  getSimilarMovies(
    movieId: number,
    page: number,
  ): Promise<{
    results: MovieSummary[]
    page: number
    totalPages: number
    totalResults: number
  }>
}
```

La implementación real puede usar tipos generados desde el OpenAPI de TMDB.

---

# 42. TMDB Detail query recomendada

Conceptualmente:

```http
GET /3/movie/{movieId}
  ?language=es-AR
  &append_to_response=credits,keywords,videos
```

El Adapter transforma esta respuesta a:

```text
MovieDetailSchema
```

---

# 43. Movie cache

No forma parte de los contratos de frontend.

Modelo conceptual:

```text
movie_cache
──────────────────────────
movie_id
language
payload
fetched_at

UNIQUE(movie_id, language)
```

El cache es:

```text
descartable
```

y no constituye fuente de verdad.

---

# 44. Esquema DB conceptual

Los contratos no obligan a usar exactamente estas columnas, pero el modelo recomendado queda alineado con el dominio.

## users

```text
id uuid PK
auth_user_id
display_name
avatar_url
onboarding_completed_at
created_at
updated_at
```

## user_preferences

```text
user_id PK/FK
preferred_genre_ids integer[]
created_at
updated_at
```

## user_movie_interactions

```text
id uuid PK
user_id FK
movie_id integer
reaction LIKE | DISLIKE | null
watched_at timestamptz null
created_at
updated_at

UNIQUE(user_id, movie_id)
CHECK(reaction IS NOT NULL OR watched_at IS NOT NULL)
```

## reviews

```text
id uuid PK
user_id FK
movie_id integer
verdict RECOMMENDED | NOT_WORTH_IT
title varchar(30)
description varchar(400)
created_at
updated_at

UNIQUE(user_id, movie_id)
```

## movie_cache

```text
movie_id integer
language varchar
payload jsonb
fetched_at timestamptz

PRIMARY KEY(movie_id, language)
```

---

# 45. Invariantes DB

La base debe reforzar reglas importantes incluso si Zod ya las valida.

```text
user_movie_interactions
UNIQUE(user_id, movie_id)
```

```text
reviews
UNIQUE(user_id, movie_id)
```

```text
reaction
CHECK LIKE | DISLIKE
```

```text
review verdict
CHECK RECOMMENDED | NOT_WORTH_IT
```

```text
reviews.title
length 3..30
```

```text
reviews.description
length 10..400
```

---

# 46. Preservación de watchedAt

Regla transaccional fundamental:

```text
PUT reaction
```

si la fila ya existe:

```text
UPDATE reaction
PRESERVE watched_at
```

No hacer:

```text
UPDATE reaction,
watched_at = null
```

al cambiar de Like a Dislike o viceversa.

---

# 47. Eliminar reacción

Al ejecutar:

```http
DELETE /api/me/movies/:movieId/reaction
```

se elimina `reaction` y se preserva `watchedAt`.

Si `watchedAt` es nulo, la fila queda vacía y se elimina. Si tiene valor, la fila permanece como:

```text
reaction = null
watchedAt = valor anterior
```

Esto mantiene ambos estados independientes.

---

# 48. Lista completa de endpoints del MVP

| Método | Endpoint | Auth | Función |
|---|---|---:|---|
| `GET` | `/api/genres` | Sí | Géneros TMDB |
| `POST` | `/api/onboarding` | Sí | Completar onboarding |
| `GET` | `/api/me/preferences` | Sí | Obtener preferencias |
| `PUT` | `/api/me/preferences` | Sí | Editar géneros preferidos |
| `GET` | `/api/movies/search` | Sí | Buscar películas |
| `GET` | `/api/movies/:movieId` | Sí | Detalle |
| `GET` | `/api/discover` | Sí | Feed recomendado |
| `PUT` | `/api/me/movies/:movieId/reaction` | Sí | LIKE / DISLIKE |
| `DELETE` | `/api/me/movies/:movieId/reaction` | Sí | Volver a neutral |
| `PUT` | `/api/me/movies/:movieId/watched` | Sí | Vista / no vista |
| `GET` | `/api/me/likes` | Sí | Lista de Me gusta |
| `GET` | `/api/movies/:movieId/reviews` | Sí | Reviews públicas |
| `PUT` | `/api/movies/:movieId/review` | Sí | Crear / editar Review |
| `DELETE` | `/api/movies/:movieId/review` | Sí | Eliminar Review |
| `POST` | `/api/chat` | Sí | Chat IA streaming |

---

# 49. Endpoints que deliberadamente NO existen

No crear:

```text
/api/watchlist
```

porque Watchlist fue eliminada.

No crear:

```text
/api/ratings
```

porque no existe rating propio 1–10.

No crear:

```text
/api/recommendations
```

como endpoint público separado.

Discover ya consume el Recommendation Engine.

No crear:

```text
/api/tmdb/*
```

como proxy genérico.

El frontend consume contratos de nuestra aplicación, no el proveedor directamente.

---

# 50. Flujo principal — onboarding

```text
Register/Login
      │
      ▼
GET genres
      │
      ▼
Search movies
      │
      ▼
Select >= 2 genres
Select >= 3 movies
      │
      ▼
POST onboarding
      │
      ├── save preferences
      │
      ├── LIKE selected movies
      │
      └── watchedAt = now()
      │
      ▼
Discover
```

---

# 51. Flujo principal — Discover

```text
GET /api/discover
      │
      ▼
Taste Profile
      │
      ▼
TMDB candidates
      │
      ▼
remove evaluated
      │
      ▼
local ranking
      │
      ▼
20 movies
      │
      ▼
swipe right / left
      │
      ▼
PUT reaction
```

---

# 52. Flujo — Me gusta

```text
LIKE
 │
 ▼
user_movie_interactions
 │
 ▼
GET /api/me/likes
 │
 ├── all
 ├── watched
 └── unwatched
```

Desde esa vista:

```text
mark watched
mark unwatched
remove LIKE
open details
```

---

# 53. Flujo — Review

```text
Movie Detail
     │
     ▼
Review form
     │
     ├── 👍 RECOMMENDED
     └── 👎 NOT_WORTH_IT
     │
     ▼
title 3..30
description 10..400
     │
     ▼
PUT review
```

---

# 54. Flujo — Chat

```text
User message
      │
      ▼
ChatService
      │
      ▼
Intent extraction
      │
      ▼
RecommendationFilters
      │
      ▼
RecommendationService
      │
      ▼
real MovieSummary[]
      │
      ▼
LLM explanation
      │
      ▼
stream
```

---

# 55. Fixtures mínimos para frontend

Una vez implementados los schemas deben crearse:

```text
src/fixtures/
  genres.ts
  movie-summary.ts
  movie-detail.ts
  discover.ts
  likes.ts
  reviews.ts
  preferences.ts
```

Los fixtures deben validarse en desarrollo:

```ts
MovieSummarySchema.parse(fixture)
```

Esto garantiza que los mocks no se desvíen de los contratos reales.

---

# 56. Parsing obligatorio

Backend:

```ts
const input =
  SetMovieReactionRequestSchema.parse(
    await request.json(),
  )
```

Frontend, cuando sea razonable validar boundary data:

```ts
const response =
  MovieDetailResponseSchema.parse(
    await res.json(),
  )
```

Como mínimo, todos los inputs externos deben validarse en el servidor.

---

# 57. Type inference

Correcto:

```ts
export type MovieSummary =
  z.infer<
    typeof MovieSummarySchema
  >
```

Incorrecto:

```ts
interface MovieSummary {
  // duplicación manual
}
```

La segunda opción permite que schema y type diverjan.

---

# 58. Imports públicos

`contracts/index.ts` debe exponer la API pública de contratos.

```ts
export * from "./common"
export * from "./errors"
export * from "./movies"
export * from "./interactions"
export * from "./onboarding"
export * from "./preferences"
export * from "./search"
export * from "./discover"
export * from "./likes"
export * from "./reviews"
export * from "./movie-detail"
export * from "./chat"
```

---

# 59. Versionado

Durante el MVP no hace falta:

```text
/api/v1
```

si frontend y backend viven dentro del mismo producto Next.js.

Los contratos compartidos y el deploy atómico reducen la necesidad de versionado HTTP temprano.

Si en el futuro existen:

```text
mobile app
public API
external clients
```

se puede introducir versionado.

---

# 60. Compatibilidad con TMDB

La estrategia de contratos mantiene intencionalmente varias decisiones de TMDB:

```text
movie IDs
genre IDs
person IDs
keyword IDs
page-based Search
image paths
Movie Summary vs Movie Detail
```

pero evita exponer su naming y response shape directamente.

Esto minimiza adaptación sin acoplar toda la UI al proveedor.

---

# 61. Compatibilidad con embeddings futuros

Agregar posteriormente:

```text
pgvector
embeddings
semantic similarity
```

no requiere modificar:

```text
MovieSummary
MovieDetail
Discover response
Likes
Reviews
Chat request
```

Sólo cambia la implementación interna de:

```text
CandidateGenerationService
RankingService
RecommendationService
```

---

# 62. Definition of Done — Contracts

La Fase 1 de contratos se considera terminada cuando:

- [ ] Los schemas de este documento existen como `.ts`.
- [ ] Todos compilan con TypeScript.
- [ ] Todos los tipos se infieren desde Zod.
- [ ] No existen interfaces duplicadas.
- [ ] Frontend puede importar contracts.
- [ ] Backend puede importar contracts.
- [ ] Fixtures validan contra contracts.
- [ ] Onboarding respeta 2 géneros + 3 películas.
- [ ] Onboarding crea LIKE + watchedAt.
- [ ] LIKE y DISLIKE preservan watchedAt al cambiar.
- [ ] DELETE reaction preserva watchedAt.
- [ ] Likes list deriva de `reaction = LIKE`.
- [ ] Filtro watched funciona.
- [ ] Review valida 3–30 / 10–400.
- [ ] Movie Detail incluye trailer nullable.
- [ ] Search usa page y 20 elementos.
- [ ] Likes usa page y 20 elementos.
- [ ] Reviews usa page y 20 elementos.
- [ ] Discover devuelve hasta 20 películas.
- [ ] Chat no persiste conversaciones.
- [ ] User ID nunca llega desde el frontend.
- [ ] El Adapter TMDB es la única frontera con el proveedor.

---

# 63. Siguiente paso

Con estos contratos cerrados, la implementación puede dividirse en paralelo:

```text
Frontend
→ desarrollar contra fixtures

Backend
→ DB + auth + routes

Integration
→ TMDB Adapter

Recommendation
→ Taste Profile + candidate generation + ranking
```

El primer vertical slice recomendado sigue siendo:

```text
Login
 ↓
TMDB movie
 ↓
Discover card
 ↓
LIKE / DISLIKE
 ↓
Supabase
 ↓
reload
 ↓
state persisted
```

---

# 64. Referencias oficiales consultadas

TMDB API v3:

- Getting Started
- Search Movies
- Movie Details
- Movie Videos
- Movie Credits
- Movie Keywords
- Discover Movie
- Genre Movie List
- Append To Response

Documentación oficial:

```text
https://developer.themoviedb.org/
```

Zod:

```text
https://zod.dev/
```

La implementación debe volver a consultar la documentación oficial si en el futuro se actualizan dependencias o endpoints del proveedor.

---

# 65. Principio final

> Los contratos representan nuestro producto; TMDB representa nuestro proveedor.

La aplicación conserva los identificadores y estructuras que resultan útiles de TMDB, pero toda interacción del usuario, regla de negocio y comportamiento del Recommendation Engine permanece bajo control de nuestro dominio.
