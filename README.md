# Film Match

### Descubrí películas que realmente van con vos.

Film Match es una experiencia de descubrimiento cinematográfico que aprende de tus gustos, entiende tus reacciones y te ayuda a encontrar tu próxima película favorita.

> **Estado:** MVP en construcción · películas solamente · recomendaciones basadas en contenido

<p align="center">
  <strong>Preferencias + Reacciones + Catálogo TMDB → Recomendaciones con criterio</strong>
</p>

## La idea

Encontrar una buena película no debería sentirse como navegar infinitamente entre opciones. Film Match combina tus preferencias, tus likes y dislikes, y la información del catálogo de TMDB para construir recomendaciones relevantes sin convertir la experiencia en una caja negra.

### Lo que estamos construyendo

- **Onboarding con intención:** elegí géneros y películas que ya disfrutaste.
- **Discover personalizado:** explorá candidatos ordenados por nuestro motor.
- **Reacciones simples:** `LIKE` y `DISLIKE`, sin ruido ni watchlists innecesarias.
- **Películas, no contenido genérico:** TMDB es nuestro catálogo canónico.
- **Chat contextual:** conversá sobre recomendaciones usando el mismo motor que alimenta Discover.
- **Reviews útiles:** compartí si una película vale la pena, con contexto real.

## Stack

| Capa | Tecnología |
| --- | --- |
| Aplicación | Next.js 16 · React 19 · TypeScript |
| Estilos y motion | Tailwind CSS 4 · Motion |
| Datos | PostgreSQL 17 · Drizzle ORM · Better Auth |
| Validación | Zod 4 · contratos compartidos |
| Catálogo | TMDB |
| IA | AI SDK |
| Testing | Vitest · Testing Library · Playwright |

## Arquitectura

El proyecto utiliza un **monolito modular**. La lógica de negocio no vive en los componentes ni en los handlers de ruta:

```text
Route / Server Action
        ↓
Application Service
        ↓
Repository / Integration
```

La estructura principal está organizada por responsabilidades y dominios:

```text
src/
├── app/            # Routes, API endpoints and application shell
├── contracts/      # Shared Zod schemas and inferred types
├── db/             # Drizzle schema and migrations
├── features/       # Domain-focused application logic
├── integrations/   # TMDB, Better Auth and Resend integrations
├── fixtures/       # Validated development and test data
└── lib/            # Shared infrastructure utilities
```

## Primeros pasos

### Requisitos

- Node.js 20+
- pnpm 11+
- Variables de entorno de PostgreSQL, Better Auth, Resend, TMDB e IA según la [guía de backend](./docs/references/foundation-backend-ops.md)

### Instalación

```bash
pnpm install
pnpm dev
```

Abrí [http://localhost:3000](http://localhost:3000) para ver la aplicación.

## Comandos útiles

```bash
pnpm dev          # Servidor de desarrollo
pnpm lint         # ESLint
pnpm typecheck    # Verificación estricta de TypeScript
pnpm test:run     # Suite de tests con Vitest
pnpm build        # Build de producción
```

### Base de datos e integración

Las migraciones requieren una conexión explícita; integración necesita una base aislada de prueba y configuración explícita. La [guía de backend](./docs/references/foundation-backend-ops.md) detalla variables y pruebas seguras.

```bash
pnpm db:generate      # Genera migraciones desde el schema de Drizzle
pnpm db:migrate       # Aplica las migraciones pendientes
pnpm db:check         # Valida la secuencia de migraciones
pnpm test:integration # PostgreSQL aislado; TMDB live requiere opt-in
```

> La suite crea y elimina únicamente fixtures en una base de prueba explícita. Nunca la apuntes a datos valiosos. Para el stack con PostgreSQL privado, seguí la [guía Docker](./docs/references/docker-deployment.md).

## Principios del producto

- Las películas se identifican directamente por su ID de TMDB.
- Un `LIKE` o `DISLIKE` excluye la película de Discover.
- Cambiar entre `LIKE` y `DISLIKE` conserva `watchedAt`.
- Quitar una reacción conserva `watchedAt`; ambos estados son independientes.
- Las reviews no modifican las recomendaciones en V1.
- Los contratos Zod son la fuente única de verdad para frontend y backend.

## Documentación de decisiones

Las especificaciones, decisiones y evidencia de ejecución se organizan en:

- [`docs/product-specs/`](./docs/product-specs/) — comportamiento y contratos aprobados.
- [`docs/design-docs/`](./docs/design-docs/) — decisiones técnicas.
- [`docs/exec-plans/completed/`](./docs/exec-plans/completed/) — cambios implementados y verificados.

Guías operativas:

- [Foundation Backend](./docs/references/foundation-backend-ops.md) — environment, conexiones, Auth, migraciones, pruebas de integración y errores de TMDB.

## Calidad antes de integrar

Antes de considerar una feature terminada:

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

Film Match está empezando, pero la base ya está pensada para crecer sin perder claridad: contratos explícitos, dominios aislados y decisiones que se puedan explicar.
