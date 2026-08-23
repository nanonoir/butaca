# Design: Discover and Onboarding Frontend Flow

## Architecture

The change preserves the modular monolith boundary:

```text
Onboarding / Discover UI
        ↓
Browser catalog client
        ↓
Public movie catalog route
        ↓
Movie catalog service
        ↓
TMDB adapter / client
```

React components never call TMDB directly. Popular movies use the canonical TMDB `/movie/popular` endpoint and the same normalized paginated movie contract used by search.

## Shared Search Control

`InlineMovieSearch` owns the presentation and interaction mechanics while the parent owns query state:

```text
Closed trigger
    ↓ click
Inline input + submit icon
    ↓ Enter or icon
Submitted query remains inline
    ↓ X or Escape
Contextual clear callback
```

The clear callback is contextual:

- Discover clears the query and restores the swipe stack.
- Onboarding clears the query and restores the popular movie list.

The control uses Motion shared-layout animation, preserves reduced-motion behavior, and restores focus to the trigger through its stable DOM id.

## Discover Layout

The shared surface is a flex column with a viewport-aware child contract. Discover uses an elastic poster row and fixed auto-sized supporting rows. A mobile short-height media mode up to 700 CSS pixels hides only the mobile Buti card and helper hint, compacts the header and reaction controls, and reduces Discover-specific shell padding.

Reaction controls remain independently reachable with touch targets above the 44px minimum. Visual grouping is tightened without overlapping the actual hit areas.

## Onboarding Layout

The `PageHeader` action receives a progress/action group:

```text
Paso 1 de 2                 Continuar con películas
Paso 2 de 2                 Completar perfil
```

The secondary `Volver a géneros` action remains after the movie grid, selected movies, and any submission error.

Popular movies are prefetched when onboarding mounts so the movie step can render a populated selection grid immediately. Search results and popular results share the same selection state, limits, pagination, loading state, and retry behavior.

## Data Flow

```text
Onboarding mounts
    ↓
fetchPopularMovies(1)
    ↓
/api/movies/popular?page=1
    ↓
TMDB /movie/popular
    ↓
SearchGrid heading="Películas populares"
```

Submitting a search swaps only the result source. It does not clear selected movies.

## Accessibility and Interaction Decisions

- Primary actions remain visible without scrolling.
- Search is a real form; Enter and the trailing icon both submit.
- The input uses a stable label and helper relationship when expanded.
- Contextual clear actions expose accessible names for their destination.
- Tests use role- and label-based selectors rather than styling hooks.

## Rollback Boundary

The change can be reverted at the UI/catalog boundary without changing database schemas, interaction persistence, recommendation ranking, or onboarding validation contracts.
