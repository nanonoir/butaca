# About Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear `/about` con una presentación breve de Butaca, atribución visible a TMDB y acceso coherente desde la navegación desktop y mobile.

**Architecture:** La página será un Server Component estático dentro de `(app)` y compondrá únicamente `PageHeader`, HTML semántico y tokens Tailwind existentes. `FloatingNavigation` seguirá siendo la única fuente de destinos para desktop y mobile; no se crearán abstracciones ni estado nuevos.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vitest y Testing Library.

## Global Constraints

- Trabajar únicamente en `feature/about-page`, creada desde el `develop` actualizado.
- Mantener `/about` dentro de `src/app/(app)` para heredar `AppShell` y la protección autenticada.
- Reutilizar `PageHeader` y los tokens actuales; no agregar componentes UI genéricos, estilos globales ni dependencias.
- Copiar exactamente el SVG proporcionado desde `C:\Users\nurym\Downloads\blue_long_2-9665a76b1ae401a510ec1e0ca40ddcb3b0cfe45f1d51b77a308fea0845885648.svg` a `public/tmdb-logo.svg`; no alterar trazados, gradiente, colores ni proporciones.
- Mostrar exactamente: `This product uses the TMDB API but is not endorsed or certified by TMDB.`
- Mostrar exactamente: `Movie information and images provided by TMDB.`
- Añadir `Acerca` como quinto destino tanto en desktop como en mobile.
- Usar TDD para todo comportamiento nuevo y Conventional Commits en español.

---

## File map

- Create: `public/tmdb-logo.svg` — recurso oficial de TMDB, sin modificaciones.
- Create: `src/app/(app)/about/page.tsx` — composición estática y semántica de `/about`.
- Create: `src/app/(app)/about/page.test.tsx` — contrato de contenido, jerarquía y atribución.
- Modify: `src/app/route-groups.test.ts` — exige que `/about` herede el product layout.
- Modify: `src/components/shared/floating-navigation.tsx` — quinto destino e ícono informativo.
- Modify: `src/components/shared/floating-navigation.test.tsx` — paridad desktop/mobile y estado activo.
- Modify: `src/features/auth/route-guard.test.ts` — documenta `/about` como ruta protegida.
- Modify: `openspec/specs/ui-foundation-prd.md` — actualiza el contrato de cuatro a cinco destinos.

---

### Task 1: Página estática y atribución oficial

**Files:**

- Create: `public/tmdb-logo.svg`
- Create: `src/app/(app)/about/page.tsx`
- Create: `src/app/(app)/about/page.test.tsx`
- Modify: `src/app/route-groups.test.ts`

**Interfaces:**

- Consumes: `PageHeader({ eyebrow, title, action? })` desde `@/components/shared/page-header`.
- Produces: ruta `/about` con un único `h1`, tres pilares y el logo `/tmdb-logo.svg`.

- [ ] **Step 1: Escribir las pruebas RED de ruta y contenido**

Añadir `"about"` a `productRoutes` en `src/app/route-groups.test.ts`.

Crear `src/app/(app)/about/page.test.tsx`:

```tsx
/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import AboutPage from "./page";

afterEach(cleanup);

describe("AboutPage", () => {
  it("presents Butaca and credits TMDB with the official asset", () => {
    render(<AboutPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Acerca de Butaca" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Encontrá tu próxima película sin perderte/i),
    ).toBeInTheDocument();

    const pillars = screen.getByRole("list", {
      name: "Cómo te acompaña Butaca",
    });
    for (const title of [
      "Descubrí",
      "Guardá tu historia",
      "Preguntale a Buti",
    ]) {
      expect(
        within(pillars).getByRole("heading", { level: 3, name: title }),
      ).toBeInTheDocument();
    }

    const logo = screen.getByRole("img", {
      name: "The Movie Database (TMDB)",
    });
    expect(logo.getAttribute("src")).toContain("tmdb-logo.svg");
    expect(
      screen.getByText(
        "This product uses the TMDB API but is not endorsed or certified by TMDB.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Movie information and images provided by TMDB."),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Ejecutar RED y comprobar el motivo correcto**

Run:

```powershell
pnpm exec vitest run 'src/app/route-groups.test.ts' 'src/app/(app)/about/page.test.tsx'
```

Expected: FAIL porque no existen `src/app/(app)/about/page.tsx` ni el módulo `./page`.

- [ ] **Step 3: Incorporar el SVG oficial sin modificarlo**

Leer el archivo proporcionado, crear `public/tmdb-logo.svg` mediante `apply_patch` con ese contenido exacto y verificar igualdad binaria:

```powershell
$sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\Users\nurym\Downloads\blue_long_2-9665a76b1ae401a510ec1e0ca40ddcb3b0cfe45f1d51b77a308fea0845885648.svg').Hash
$repoHash = (Get-FileHash -Algorithm SHA256 -LiteralPath 'public\tmdb-logo.svg').Hash
if ($sourceHash -ne $repoHash) { throw 'El SVG de TMDB fue alterado.' }
```

- [ ] **Step 4: Implementar la página mínima**

Crear `src/app/(app)/about/page.tsx`:

```tsx
import Image from "next/image";

import { PageHeader } from "@/components/shared/page-header";

const PRODUCT_PILLARS = [
  {
    title: "Descubrí",
    copy: "Recorré una selección de películas que se ajusta a tus gustos.",
  },
  {
    title: "Guardá tu historia",
    copy: "Me gusta, No me gusta y Vista registran tus preferencias sin mezclar reacción y visualización.",
  },
  {
    title: "Preguntale a Buti",
    copy: "Transformá una intención o un ánimo en recomendaciones concretas.",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 py-4 md:py-8">
      <PageHeader eyebrow="Butaca" title="Acerca de Butaca" />

      <section aria-labelledby="about-product-title" className="max-w-3xl">
        <h2 className="sr-only" id="about-product-title">
          Qué es Butaca
        </h2>
        <p className="text-base leading-7 text-muted">
          Encontrá tu próxima película sin perderte en el catálogo. Butaca
          combina tus géneros, reacciones y películas vistas para ordenar
          recomendaciones personales; Buti te ayuda a afinarlas conversando.
        </p>
      </section>

      <section aria-labelledby="about-pillars-title" className="space-y-6">
        <h2
          className="font-display text-2xl font-medium tracking-[-0.02em] text-foreground"
          id="about-pillars-title"
        >
          Una experiencia que aprende de vos
        </h2>
        <ul
          aria-label="Cómo te acompaña Butaca"
          className="grid gap-4 md:grid-cols-3"
        >
          {PRODUCT_PILLARS.map(({ title, copy }, index) => (
            <li
              className="rounded-lg border border-border bg-surface-muted p-5 md:p-6"
              key={title}
            >
              <span className="font-mono text-xs tracking-[0.14em] text-primary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-5 font-display text-xl font-medium tracking-[-0.02em] text-foreground">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tmdb-title" className="space-y-6">
        <h2
          className="font-display text-2xl font-medium tracking-[-0.02em] text-foreground"
          id="tmdb-title"
        >
          Información cinematográfica
        </h2>
        <div className="grid gap-8 rounded-lg border border-border bg-surface-muted p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] md:items-center md:p-6">
          <div
            className="relative w-full max-w-[24rem]"
            style={{ aspectRatio: "489.04 / 35.4" }}
          >
            <Image
              alt="The Movie Database (TMDB)"
              className="object-contain object-left"
              fill
              sizes="(min-width: 768px) 24rem, calc(100vw - 3rem)"
              src="/tmdb-logo.svg"
            />
          </div>
          <div className="space-y-3 text-sm leading-6 text-muted">
            <p>
              This product uses the TMDB API but is not endorsed or certified by
              TMDB.
            </p>
            <p>Movie information and images provided by TMDB.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Ejecutar GREEN**

Run:

```powershell
pnpm exec vitest run 'src/app/route-groups.test.ts' 'src/app/(app)/about/page.test.tsx'
```

Expected: ambos archivos de prueba pasan.

- [ ] **Step 6: Commit**

```powershell
git add -- 'public/tmdb-logo.svg' 'src/app/(app)/about/page.tsx' 'src/app/(app)/about/page.test.tsx' 'src/app/route-groups.test.ts'
git diff --cached --check
git commit -m "feat(about): agrega la página informativa"
```

---

### Task 2: Quinto destino en la navegación compartida

**Files:**

- Modify: `src/components/shared/floating-navigation.test.tsx`
- Modify: `src/components/shared/floating-navigation.tsx`

**Interfaces:**

- Consumes: `usePathname()` e `isActivePath(pathname, href)` existentes.
- Produces: dos enlaces a `/about`, uno desktop y otro mobile, ambos con label `Acerca` e `InfoIcon`.

- [ ] **Step 1: Escribir las pruebas RED de destino y estado activo**

En `floating-navigation.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  usePathname.mockReturnValue("/");
});
```

Actualizar el contrato de destinos:

```tsx
expect(screen.getAllByRole("link")).toHaveLength(10);

for (const [label, href] of [
  ["Descubrir", "/"],
  ["Me gusta", "/liked"],
  ["IA", "/ai"],
  ["Perfil", "/profile"],
  ["Acerca", "/about"],
]) {
  // conservar las aserciones existentes de dos presentaciones por destino
}
```

Añadir:

```tsx
it("marks About as active in desktop and mobile navigation", () => {
  usePathname.mockReturnValue("/about");
  render(<FloatingNavigation />);

  const aboutLinks = screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("href") === "/about");

  expect(aboutLinks).toHaveLength(2);
  for (const link of aboutLinks) {
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveAttribute("data-active", "true");
  }
});
```

Actualizar el texto esperado en mobile a `DescubrirMe gustaIAPerfilAcerca`.

- [ ] **Step 2: Ejecutar RED**

Run:

```powershell
pnpm exec vitest run src/components/shared/floating-navigation.test.tsx
```

Expected: FAIL porque sólo existen ocho links y ninguno apunta a `/about`.

- [ ] **Step 3: Implementar el destino e ícono**

Agregar al final de `NAVIGATION_ITEMS`:

```tsx
{ href: "/about", label: "Acerca", icon: InfoIcon },
```

Agregar junto a los iconos existentes:

```tsx
function InfoIcon({ className }: NavigationIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 10.5V17"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="7.5" fill="currentColor" r="1" />
    </svg>
  );
}
```

No cambiar render, clases, hover ni layout: ambas presentaciones consumen la misma constante.

- [ ] **Step 4: Ejecutar GREEN**

Run:

```powershell
pnpm exec vitest run src/components/shared/floating-navigation.test.tsx
```

Expected: todas las pruebas de navegación pasan con diez links.

- [ ] **Step 5: Commit**

```powershell
git add -- 'src/components/shared/floating-navigation.tsx' 'src/components/shared/floating-navigation.test.tsx'
git diff --cached --check
git commit -m "feat(navigation): agrega acceso a Acerca"
```

---

### Task 3: Contratos de protección y UI Foundation

**Files:**

- Modify: `src/features/auth/route-guard.test.ts`
- Modify: `openspec/specs/ui-foundation-prd.md`

**Interfaces:**

- Consumes: comportamiento existente de `resolveRouteGuard`, que protege toda ruta no pública.
- Produces: documentación y cobertura explícita para el quinto destino `/about`.

- [ ] **Step 1: Añadir `/about` a la cobertura del route guard**

En la lista de rutas de producto para invitados, agregar:

```ts
"/about",
```

En la lista de rutas accesibles para usuarios autenticados, usar:

```ts
for (const pathname of ["/", "/liked", "/ai", "/profile", "/about"]) {
```

- [ ] **Step 2: Ejecutar la cobertura del guard**

Run:

```powershell
pnpm exec vitest run src/features/auth/route-guard.test.ts
```

Expected: PASS; no se modifica `route-guard.ts` porque `/about` ya queda protegido por defecto.

- [ ] **Step 3: Actualizar la especificación de navegación**

En `openspec/specs/ui-foundation-prd.md`:

- reemplazar las cinco apariciones contractuales de `four` por `five`;
- agregar a la tabla de destinos:

```markdown
| About | `Acerca` | Product information |
```

- agregar a la tabla de cobertura:

```markdown
| About | `Acerca` navigation item | Yes | Yes | Product summary and TMDB attribution |
```

No cambiar tokens, geometría ni interacción de la navegación.

- [ ] **Step 4: Verificar formato y commit**

Run:

```powershell
pnpm exec prettier --check 'openspec/specs/ui-foundation-prd.md' 'src/features/auth/route-guard.test.ts'
git diff --check
```

Expected: formato válido y diff sin whitespace errors.

```powershell
git add -- 'src/features/auth/route-guard.test.ts' 'openspec/specs/ui-foundation-prd.md'
git diff --cached --check
git commit -m "docs(ui): incorpora Acerca en la navegación"
```

---

### Task 4: Verificación integral y visual

**Files:**

- Verify only; cualquier ajuste debe limitarse a los archivos listados en este plan.

**Interfaces:**

- Consumes: `/about`, `FloatingNavigation` y los contratos actualizados.
- Produces: evidencia de calidad, responsive, accesibilidad y ausencia de regresiones.

- [ ] **Step 1: Verificar el asset oficial**

```powershell
$sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\Users\nurym\Downloads\blue_long_2-9665a76b1ae401a510ec1e0ca40ddcb3b0cfe45f1d51b77a308fea0845885648.svg').Hash
$repoHash = (Get-FileHash -Algorithm SHA256 -LiteralPath 'public\tmdb-logo.svg').Hash
if ($sourceHash -ne $repoHash) { throw 'El SVG de TMDB fue alterado.' }
```

Expected: hashes idénticos.

- [ ] **Step 2: Ejecutar los gates completos**

```powershell
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

Expected: exit code `0` en los cuatro comandos.

- [ ] **Step 3: Validar en navegador**

Iniciar el servidor y abrir `/about`:

```powershell
pnpm dev
```

Comprobar con el navegador integrado:

- desktop `1440x900`: quinto botón visible en el rail, hover/focus sin reflow, logo completo y panel TMDB en dos columnas;
- mobile `390x844`: cinco destinos visibles, panel apilado, sin solapamiento con barra inferior;
- mobile estrecho `320x800`: sin overflow horizontal ni recorte de `Acerca`;
- navegación por teclado: foco visible y `aria-current="page"`;
- consola: sin errores ni warnings propios de la página.

- [ ] **Step 4: Revisión final del branch**

```powershell
git status --short --branch
git diff --check origin/develop...HEAD
git log --oneline origin/develop..HEAD
```

Expected: worktree limpio, diff válido y commits limitados a diseño, plan e implementación de `/about`.
