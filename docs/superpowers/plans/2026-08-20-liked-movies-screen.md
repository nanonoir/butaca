# Liked Movies Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/liked` screen from the approved reference with locally validated movie data and functional watched-state filters.

**Architecture:** The App Router page remains a server component that loads a Zod-validated local fixture. A feature-owned client component renders the UI and owns only the temporary filter selection; filtered movies are derived during render. Shared UI is reused, with one additive `MoviePosterCard` metadata slot needed by the reference composition.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Zod, Vitest, Testing Library.

## Global Constraints

- Existing UI Foundation tokens and components are the visual source of truth.
- Do not add dependencies, backend calls, persistence, or unrelated refactors.
- Keep `PillTabs`, watched badges, and poster placeholders owned by `features/likes`.
- Use `LikedMovieItem` and `LikesWatchedFilter` inferred from the existing Zod contracts.
- Preserve UTF-8 Spanish copy and verify desktop and mobile behavior.

---

### Task 1: Extend the shared movie card

**Files:**

- Modify: `src/components/shared/movie-poster-card.test.tsx`
- Modify: `src/components/shared/movie-poster-card.tsx`

**Interfaces:**

- Consumes: Existing `title`, `year`, `poster`, and `presentationSlot` props.
- Produces: Optional `metadataSlot?: ReactNode` and a two-line movie title treatment.

- [ ] **Step 1: Write the failing test**

Add a metadata action to the existing card test and assert that it renders beside the title metadata. Assert that the title uses the two-line treatment instead of single-line truncation.

```tsx
<MoviePosterCard
  title="A sample film"
  year="2024"
  poster={<div data-testid="poster">Poster content</div>}
  metadataSlot={<span data-testid="metadata-slot">...</span>}
/>;

expect(screen.getByTestId("metadata-slot")).toBeTruthy();
expect(screen.getByRole("heading", { name: "A sample film" })).toHaveClass(
  "line-clamp-2",
);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec vitest run src/components/shared/movie-poster-card.test.tsx`

Expected: FAIL because the current card does not render `metadataAction` and still uses `truncate`.

- [ ] **Step 3: Implement the minimal shared extension**

Add the optional prop and render the metadata row with a flexible text column and a shrink-free presentation column.

```tsx
export interface MoviePosterCardProps {
  title: string;
  year?: string;
  poster: ReactNode;
  presentationSlot?: ReactNode;
  metadataSlot?: ReactNode;
}
```

Use `line-clamp-2` on the heading. Preserve all existing poster and presentation-slot behavior.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm exec vitest run src/components/shared/movie-poster-card.test.tsx`

Expected: PASS with the existing optional-state test still green.

### Task 2: Build the feature-owned liked movies screen

**Files:**

- Create: `src/features/likes/liked-movies-screen.test.tsx`
- Create: `src/features/likes/liked-movies-screen.tsx`
- Modify: `vitest.config.ts`

**Interfaces:**

- Consumes: `items: LikedMovieItem[]`, `PageHeader`, `MoviePosterCard`, `Button`, and `LikesWatchedFilter`.
- Produces: `LikedMoviesScreen({ items }: LikedMoviesScreenProps)`.

- [ ] **Step 1: Add the feature test to Vitest and write failing behavior tests**

Extend the Vitest include list with `src/features/**/*.test.tsx`. Test a three-item list containing one watched and two unwatched movies.

```tsx
render(<LikedMoviesScreen items={ITEMS} />);

expect(screen.getByRole("heading", { name: "Mis películas" })).toBeTruthy();
expect(screen.getByText("3 películas")).toBeTruthy();
fireEvent.click(screen.getByRole("button", { name: "Vistas" }));
expect(screen.getByText("Interstellar")).toBeTruthy();
expect(screen.queryByText("Parásitos")).toBeNull();
expect(screen.getByText("1 película")).toBeTruthy();
```

Add a second assertion path for `No vistas` and verify that `aria-pressed` follows the active filter.

- [ ] **Step 2: Run the feature test and verify RED**

Run: `pnpm exec vitest run src/features/likes/liked-movies-screen.test.tsx`

Expected: FAIL because `LikedMoviesScreen` does not exist yet.

- [ ] **Step 3: Implement the minimal client component**

Create a client component with `useState<LikesWatchedFilter>("all")`. Keep the filter options, watched badge, eye icon, poster placeholder, and overflow glyph private to the feature. Derive visible items directly during render:

```tsx
const visibleItems = items.filter((item) => {
  if (activeFilter === "all") return true;
  return activeFilter === "watched"
    ? item.watchedAt !== null
    : item.watchedAt === null;
});
```

Render:

- `PageHeader` with `Tu biblioteca`, `Mis películas`, and an `aria-live` count.
- Three pill-shaped existing `Button` controls using `aria-pressed`.
- A responsive `ul` poster grid from two mobile columns through five `xl` and six `2xl` columns.
- `MoviePosterCard` for every result.
- A semantic-token poster placeholder and a watched badge only when `watchedAt` is non-null.

- [ ] **Step 4: Run the feature test and verify GREEN**

Run: `pnpm exec vitest run src/features/likes/liked-movies-screen.test.tsx`

Expected: PASS for the initial, watched, and unwatched states.

### Task 3: Connect validated local data to `/liked`

**Files:**

- Create: `src/fixtures/liked-movies.ts`
- Create: `src/app/liked/page.tsx`

**Interfaces:**

- Consumes: `LikesResponseSchema`, the existing TMDB-shaped movie contract, and `LikedMoviesScreen`.
- Produces: `LIKED_MOVIES_FIXTURE` with ten records and the `/liked` route.

- [ ] **Step 1: Add the local fixture**

Create ten reference movies and parse the complete paginated object at module load:

```ts
export const LIKED_MOVIES_FIXTURE = LikesResponseSchema.parse({
  data: [
    {
      movie: {
        id: 157336,
        title: "Interstellar",
        originalTitle: "Interstellar",
        overview:
          "Un viaje más allá de nuestra galaxia para asegurar el futuro de la humanidad.",
        posterPath: null,
        backdropPath: null,
        genreIds: [12, 18, 878],
        releaseDate: "2014-11-05",
        originalLanguage: "en",
        tmdbRating: 8.5,
        tmdbVoteCount: 37800,
      },
      likedAt: "2026-08-01T14:00:00Z",
      watchedAt: "2026-07-28T22:00:00Z",
    },
    {
      movie: {
        id: 496243,
        title: "Parásitos",
        originalTitle: "기생충",
        overview:
          "Dos familias quedan unidas por una relación tan inesperada como desigual.",
        posterPath: null,
        backdropPath: null,
        genreIds: [18, 35, 53],
        releaseDate: "2019-05-30",
        originalLanguage: "ko",
        tmdbRating: 8.5,
        tmdbVoteCount: 19000,
      },
      likedAt: "2026-08-02T14:00:00Z",
      watchedAt: "2026-07-30T22:00:00Z",
    },
    {
      movie: {
        id: 244786,
        title: "Whiplash",
        originalTitle: "Whiplash",
        overview: "Un baterista ambicioso enfrenta a un instructor implacable.",
        posterPath: null,
        backdropPath: null,
        genreIds: [18, 10402],
        releaseDate: "2014-10-10",
        originalLanguage: "en",
        tmdbRating: 8.4,
        tmdbVoteCount: 15600,
      },
      likedAt: "2026-08-03T14:00:00Z",
      watchedAt: "2026-08-01T22:00:00Z",
    },
    {
      movie: {
        id: 152601,
        title: "Her",
        originalTitle: "Her",
        overview:
          "Un escritor solitario desarrolla un vínculo con un sistema operativo.",
        posterPath: null,
        backdropPath: null,
        genreIds: [18, 10749, 878],
        releaseDate: "2013-12-18",
        originalLanguage: "en",
        tmdbRating: 7.8,
        tmdbVoteCount: 14400,
      },
      likedAt: "2026-08-04T14:00:00Z",
      watchedAt: null,
    },
    {
      movie: {
        id: 335984,
        title: "Blade Runner 2049",
        originalTitle: "Blade Runner 2049",
        overview:
          "Un nuevo blade runner descubre un secreto capaz de alterar el orden social.",
        posterPath: null,
        backdropPath: null,
        genreIds: [18, 878],
        releaseDate: "2017-10-04",
        originalLanguage: "en",
        tmdbRating: 7.6,
        tmdbVoteCount: 13700,
      },
      likedAt: "2026-08-05T14:00:00Z",
      watchedAt: "2026-08-03T22:00:00Z",
    },
    {
      movie: {
        id: 545611,
        title: "Todo en todas partes al mismo tiempo",
        originalTitle: "Everything Everywhere All at Once",
        overview:
          "Una mujer común atraviesa múltiples universos para salvar lo que ama.",
        posterPath: null,
        backdropPath: null,
        genreIds: [12, 28, 878],
        releaseDate: "2022-03-24",
        originalLanguage: "en",
        tmdbRating: 7.7,
        tmdbVoteCount: 7200,
      },
      likedAt: "2026-08-06T14:00:00Z",
      watchedAt: null,
    },
    {
      movie: {
        id: 376867,
        title: "Moonlight",
        originalTitle: "Moonlight",
        overview: "Tres etapas en la vida de un joven que busca su identidad.",
        posterPath: null,
        backdropPath: null,
        genreIds: [18],
        releaseDate: "2016-10-21",
        originalLanguage: "en",
        tmdbRating: 7.4,
        tmdbVoteCount: 7100,
      },
      likedAt: "2026-08-07T14:00:00Z",
      watchedAt: null,
    },
    {
      movie: {
        id: 264660,
        title: "Ex Machina",
        originalTitle: "Ex Machina",
        overview:
          "Un programador evalúa la inteligencia de un androide extraordinario.",
        posterPath: null,
        backdropPath: null,
        genreIds: [18, 878],
        releaseDate: "2015-01-21",
        originalLanguage: "en",
        tmdbRating: 7.6,
        tmdbVoteCount: 13600,
      },
      likedAt: "2026-08-08T14:00:00Z",
      watchedAt: null,
    },
    {
      movie: {
        id: 129,
        title: "El viaje de Chihiro",
        originalTitle: "千と千尋の神隠し",
        overview:
          "Una niña entra en un mundo de espíritus y debe encontrar el camino a casa.",
        posterPath: null,
        backdropPath: null,
        genreIds: [16, 14, 10751],
        releaseDate: "2001-07-20",
        originalLanguage: "ja",
        tmdbRating: 8.5,
        tmdbVoteCount: 17100,
      },
      likedAt: "2026-08-09T14:00:00Z",
      watchedAt: "2026-08-07T22:00:00Z",
    },
    {
      movie: {
        id: 531428,
        title: "Retrato de una mujer en llamas",
        originalTitle: "Portrait de la jeune fille en feu",
        overview:
          "Una pintora y su modelo construyen una intimidad inesperada.",
        posterPath: null,
        backdropPath: null,
        genreIds: [18, 10749],
        releaseDate: "2019-09-18",
        originalLanguage: "fr",
        tmdbRating: 8.1,
        tmdbVoteCount: 2800,
      },
      likedAt: "2026-08-10T14:00:00Z",
      watchedAt: null,
    },
  ],
  meta: {
    page: 1,
    pageSize: 20,
    totalPages: 1,
    totalResults: 10,
    hasNextPage: false,
  },
});
```

Use watched timestamps for the five cards marked `VISTA` in the reference and `null` for the other five.

- [ ] **Step 2: Add the App Router page**

```tsx
import { LikedMoviesScreen } from "@/features/likes/liked-movies-screen";
import { LIKED_MOVIES_FIXTURE } from "@/fixtures/liked-movies";

export default function LikedMoviesPage() {
  return <LikedMoviesScreen items={LIKED_MOVIES_FIXTURE.data} />;
}
```

- [ ] **Step 3: Run the complete automated suite**

Run: `pnpm test:run`

Expected: all prior tests and new feature tests pass.

### Task 4: Quality and rendered verification

**Files:**

- Verify only; no committed screenshots or reports.

**Interfaces:**

- Consumes: Running Next.js app at `http://localhost:3000/liked`.
- Produces: Evidence that the route, filters, layout, and responsive states work.

- [ ] **Step 1: Run static quality gates**

Run, independently: `pnpm typecheck`, `pnpm lint`, and `pnpm build`.

Expected: all commands exit with code 0.

- [ ] **Step 2: Verify the target flow in the in-app browser**

The flow under test is: `/liked` loads with ten movies -> select `Vistas` -> five watched movies remain -> select `No vistas` -> five unwatched movies remain.

Check page identity, meaningful DOM, absence of framework overlays, console warnings/errors, keyboard-visible filter state, and screenshot evidence at desktop and mobile sizes.

- [ ] **Step 3: Review scope and diff**

Run: `git status --short` and `git diff --check`.

Expected: only the plan, shared card extension, Likes feature, fixture, route, and related Vitest config are modified.

## Execution

Inline execution was selected by the user's explicit request to implement the recommended option. No subagents or additional worktree will be used; work remains on `nuria/frontend-views`.
